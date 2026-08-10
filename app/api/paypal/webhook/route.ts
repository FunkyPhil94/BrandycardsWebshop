import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orders, payments, webhookEvents } from "../../../../db/schema";
import { notifyOrderPaid } from "../../../../lib/email/notify.ts";
import { getPayPalConfig } from "../../../../lib/paypal/config";
import { verifyPayPalWebhookSignature } from "../../../../lib/paypal/client";
import { webhookCaptureAction } from "../../../../lib/paypal/webhook-decision";
import { PAYPAL_WEBHOOK_RECEIVED_RETRY_AFTER_MS, receivedWebhookRetryDue } from "../../../../lib/paypal/webhook-retry";
import { releaseOrderReservations, settlePaidOrder } from "../../../../lib/paypal/settle-order";
import { centsToPayPalValue } from "../../../../lib/paypal/money";
import { notifyOperationalAlert } from "../../../../lib/ops-alerts";
import { readTextBody, RequestBodyError } from "../../../../lib/request-body";

const PAYPAL_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

type PayPalWebhookEvent = {
  id?: unknown;
  event_type?: unknown;
  resource?: {
    id?: unknown;
    custom_id?: unknown;
    reference_id?: unknown;
    supplementary_data?: { related_ids?: { order_id?: unknown } };
    amount?: { value?: unknown; currency_code?: unknown };
  };
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function findPayment(db: ReturnType<typeof getDb>, event: PayPalWebhookEvent, strictProviderOrder = false) {
  const resource = event.resource;
  const paypalOrderId = stringValue(resource?.supplementary_data?.related_ids?.order_id);
  const customId = stringValue(resource?.custom_id);
  const referenceId = stringValue(resource?.reference_id);
  const providerOrderIds = [paypalOrderId, customId, referenceId].filter((value): value is string => Boolean(value));
  const appOrderIds = [customId, referenceId].filter((value): value is string => Boolean(value));

  for (const providerOrderId of strictProviderOrder ? (paypalOrderId ? [paypalOrderId] : []) : providerOrderIds) {
    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.provider, "PAYPAL"), eq(payments.providerOrderId, providerOrderId)),
    });
    if (payment) return payment;
  }
  for (const orderId of appOrderIds) {
    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.provider, "PAYPAL"), eq(payments.orderId, orderId)),
    });
    if (payment) return payment;
  }
  return null;
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await readTextBody(request, PAYPAL_WEBHOOK_MAX_BODY_BYTES);
  } catch (error) {
    return NextResponse.json({ error: error instanceof RequestBodyError ? error.message : "Webhook konnte nicht gelesen werden." }, { status: error instanceof RequestBodyError ? error.status : 400 });
  }
  let db: ReturnType<typeof getDb> | undefined;
  let eventId = "";
  let previousFailure = false;
  try {
    const config = getPayPalConfig();
    if (!config.webhookId) return NextResponse.json({ error: "PayPal-Webhook ist noch nicht konfiguriert." }, { status: 503 });
    const event = JSON.parse(rawBody) as PayPalWebhookEvent;
    eventId = typeof event.id === "string" ? event.id : "";
    const eventType = typeof event.event_type === "string" ? event.event_type : "";
    if (!eventId || !eventType) return NextResponse.json({ error: "Ungültiges Webhook-Ereignis." }, { status: 400 });

    const header = (name: string) => request.headers.get(name) ?? "";
    const verified = await verifyPayPalWebhookSignature({ body: rawBody, webhookId: config.webhookId, transmissionId: header("paypal-transmission-id"), transmissionTime: header("paypal-transmission-time"), certUrl: header("paypal-cert-url"), authAlgo: header("paypal-auth-algo"), transmissionSig: header("paypal-transmission-sig") });
    if (!verified) return NextResponse.json({ error: "Ungültige Webhook-Signatur." }, { status: 400 });

    db = getDb();
    const existing = await db.query.webhookEvents.findFirst({ where: and(eq(webhookEvents.provider, "PAYPAL"), eq(webhookEvents.externalEventId, eventId)) });
    previousFailure = existing?.status === "FAILED";
    if (existing?.status === "PROCESSED") return NextResponse.json({ ok: true, duplicate: true });
    if (existing?.status === "RECEIVED" && !receivedWebhookRetryDue(existing.receivedAt)) {
      return NextResponse.json({ ok: false, retryable: true }, { status: 503, headers: { "retry-after": String(PAYPAL_WEBHOOK_RECEIVED_RETRY_AFTER_MS / 1000) } });
    }
    const receivedAt = new Date().toISOString();
    if (existing?.status === "FAILED") {
      await db.update(webhookEvents).set({ status: "RECEIVED", eventType, payload: event, receivedAt, processedAt: null, errorMessage: null }).where(eq(webhookEvents.id, existing.id));
    } else if (existing?.status === "RECEIVED") {
      // Claim an old row conditionally. A second request that observed the
      // same old timestamp must wait for PayPal to retry instead of entering
      // the payment path in parallel.
      const claim = await db.batch([db.update(webhookEvents).set({ eventType, payload: event, receivedAt, processedAt: null, errorMessage: null }).where(and(
        eq(webhookEvents.id, existing.id),
        eq(webhookEvents.status, "RECEIVED"),
        eq(webhookEvents.receivedAt, existing.receivedAt),
      ))]);
      if (claim[0].meta.changes !== 1) {
        return NextResponse.json({ ok: false, retryable: true }, { status: 503, headers: { "retry-after": String(PAYPAL_WEBHOOK_RECEIVED_RETRY_AFTER_MS / 1000) } });
      }
    } else {
      await db.insert(webhookEvents).values({ provider: "PAYPAL", externalEventId: eventId, eventType, status: "RECEIVED", payload: event, receivedAt });
    }

    const strictPaymentEvent = eventType.startsWith("PAYMENT.CAPTURE.");
    const payment = await findPayment(db, event, strictPaymentEvent);
    const now = receivedAt;
    // Ein bereits eingezogenes Ereignis ist eine Dublette — aber **kein Grund,
    // vorzeitig auszusteigen.** Genau das tat diese Route bis zum 2026-08-08:
    // Sie kehrte mit `duplicate: true` zurück, bevor die Zeile in
    // `webhook_events` auf `PROCESSED` gesetzt wurde, und ließ damit einen
    // sauber abgewiesenen Vorgang wie einen hängen gebliebenen aussehen
    // (nachgewiesen an `WH-4MD290111R3948627-…` vom 06:10:22).
    //
    // Der Merker statt des `return` ist die eigentliche Korrektur: Es gibt
    // keinen Ausgang mehr, der an der Buchführung vorbeiführt.
    let duplicate = false;
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      if (!payment) throw new Error("Zugehörige PayPal-Zahlung wurde nicht gefunden.");
      const order = await db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) });
      const webhookValue = stringValue(event.resource?.amount?.value);
      const webhookCurrency = stringValue(event.resource?.amount?.currency_code);
      if (!order || !webhookValue || !webhookCurrency || webhookValue !== centsToPayPalValue(order.totalAmountCents) || webhookCurrency !== order.currency || payment.amountCents !== order.totalAmountCents || payment.currency !== order.currency) {
        throw new Error("PayPal-Webhook-Betrag oder Währung stimmt nicht mit der Bestellung überein.");
      }
      const captureId = stringValue(event.resource?.id);
      const action = webhookCaptureAction(payment.status);
      if (action === "erstattet") throw new Error("Eine erstattete Zahlung kann nicht erneut als bezahlt markiert werden.");
      if (action === "dublette") {
        duplicate = true;
      } else {
        // Bedingt geschrieben, wie in `app/api/paypal/capture/route.ts`: Die
        // Rückkehr des Kunden aus PayPal kann dieselbe Zahlung gleichzeitig
        // einziehen. Nur wer den Übergang gewinnt, verschickt die Bestätigung.
        const captureClaim = await db.batch([db.update(payments).set({
          status: "CAPTURED",
          ...(captureId ? { providerCaptureId: captureId } : {}),
          rawData: event,
          updatedAt: now,
        }).where(and(eq(payments.id, payment.id), inArray(payments.status, ["CREATED", "APPROVED"])))]);
        await db.update(orders).set({ status: "PAID", paidAt: now, updatedAt: now }).where(eq(orders.id, payment.orderId));
        await settlePaidOrder(db, payment.orderId, now);
        if (captureClaim[0].meta.changes === 1) await notifyOrderPaid(db, payment.orderId, "NICHT_GELAUFEN");
      }
    } else if (eventType === "PAYMENT.CAPTURE.DENIED" || eventType === "PAYMENT.CAPTURE.DECLINED") {
      if (!payment) throw new Error("Zugehörige PayPal-Zahlung wurde nicht gefunden.");
      await db.update(payments).set({ status: "FAILED", rawData: event, updatedAt: now }).where(and(eq(payments.id, payment.id), inArray(payments.status, ["CREATED", "APPROVED"])));
      await releaseOrderReservations(db, payment.orderId, now);
    } else if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
      if (!payment) throw new Error("Zugehörige PayPal-Zahlung wurde nicht gefunden.");
      await db.update(payments).set({ status: "REFUNDED", rawData: event, updatedAt: now }).where(and(eq(payments.id, payment.id), inArray(payments.status, ["CAPTURED", "REFUNDED"])));
      await db.update(orders).set({ status: "REFUNDED", refundedAt: now, updatedAt: now }).where(and(eq(orders.id, payment.orderId), inArray(orders.status, ["PAID", "REFUNDED"])));
    }

    // Der eine Ausgang, den jeder Pfad nimmt — auch der Dubletten-Pfad. Die
    // Zeile sagt damit die Wahrheit: fertig verarbeitet, nichts hängt.
    await db.update(webhookEvents).set({ status: "PROCESSED", processedAt: now }).where(and(eq(webhookEvents.provider, "PAYPAL"), eq(webhookEvents.externalEventId, eventId)));
    return NextResponse.json(duplicate ? { ok: true, duplicate: true } : { ok: true, processed: true });
  } catch (error) {
    console.error("PayPal webhook failed", error);
    if (db && eventId) {
      try {
        await db.update(webhookEvents).set({ status: "FAILED", processedAt: new Date().toISOString(), errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler." }).where(and(eq(webhookEvents.provider, "PAYPAL"), eq(webhookEvents.externalEventId, eventId)));
      } catch (statusError) {
        console.error("PayPal webhook status update failed", statusError);
      }
      if (!previousFailure) {
        await notifyOperationalAlert({
          key: `paypal-webhook:${eventId}`,
          category: "PayPal-Webhook",
          title: "Webhook konnte nicht verarbeitet werden",
          detail: error instanceof Error ? error.message : "Unbekannter Fehler.",
        });
      }
    }
    return NextResponse.json({ error: "Webhook konnte nicht verarbeitet werden." }, { status: 400 });
  }
}
