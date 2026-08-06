import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orders, payments, webhookEvents } from "../../../../db/schema";
import { getPayPalConfig } from "../../../../lib/paypal/config";
import { verifyPayPalWebhookSignature } from "../../../../lib/paypal/client";
import { settlePaidOrder } from "../../../../lib/paypal/settle-order";

type PayPalWebhookEvent = {
  id?: unknown;
  event_type?: unknown;
  resource?: {
    id?: unknown;
    custom_id?: unknown;
    reference_id?: unknown;
    supplementary_data?: { related_ids?: { order_id?: unknown } };
  };
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function findPayment(db: ReturnType<typeof getDb>, event: PayPalWebhookEvent) {
  const resource = event.resource;
  const paypalOrderId = stringValue(resource?.supplementary_data?.related_ids?.order_id);
  const customId = stringValue(resource?.custom_id);
  const referenceId = stringValue(resource?.reference_id);
  const providerOrderIds = [paypalOrderId, customId, referenceId].filter((value): value is string => Boolean(value));
  const appOrderIds = [customId, referenceId].filter((value): value is string => Boolean(value));

  for (const providerOrderId of providerOrderIds) {
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
  const rawBody = await request.text();
  let db: ReturnType<typeof getDb> | undefined;
  let eventId = "";
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
    if (existing) return NextResponse.json({ ok: true, duplicate: true });
    await db.insert(webhookEvents).values({ provider: "PAYPAL", externalEventId: eventId, eventType, status: "RECEIVED", payload: event, receivedAt: new Date().toISOString() });

    const payment = await findPayment(db, event);
    const now = new Date().toISOString();
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      if (!payment) throw new Error("Zugehörige PayPal-Zahlung wurde nicht gefunden.");
      const captureId = stringValue(event.resource?.id);
      await db.update(payments).set({
        status: "CAPTURED",
        ...(captureId ? { providerCaptureId: captureId } : {}),
        rawData: event,
        updatedAt: now,
      }).where(eq(payments.id, payment.id));
      await db.update(orders).set({ status: "PAID", paidAt: now, updatedAt: now }).where(eq(orders.id, payment.orderId));
      await settlePaidOrder(db, payment.orderId, now);
    } else if (eventType === "PAYMENT.CAPTURE.DENIED" || eventType === "PAYMENT.CAPTURE.DECLINED") {
      if (!payment) throw new Error("Zugehörige PayPal-Zahlung wurde nicht gefunden.");
      await db.update(payments).set({ status: "FAILED", rawData: event, updatedAt: now }).where(eq(payments.id, payment.id));
    } else if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
      if (!payment) throw new Error("Zugehörige PayPal-Zahlung wurde nicht gefunden.");
      await db.update(payments).set({ status: "REFUNDED", rawData: event, updatedAt: now }).where(eq(payments.id, payment.id));
      await db.update(orders).set({ status: "REFUNDED", updatedAt: now }).where(eq(orders.id, payment.orderId));
    }

    await db.update(webhookEvents).set({ status: "PROCESSED", processedAt: now }).where(and(eq(webhookEvents.provider, "PAYPAL"), eq(webhookEvents.externalEventId, eventId)));
    return NextResponse.json({ ok: true, processed: true });
  } catch (error) {
    console.error("PayPal webhook failed", error);
    if (db && eventId) {
      try {
        await db.update(webhookEvents).set({ status: "FAILED", processedAt: new Date().toISOString(), errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler." }).where(and(eq(webhookEvents.provider, "PAYPAL"), eq(webhookEvents.externalEventId, eventId)));
      } catch (statusError) {
        console.error("PayPal webhook status update failed", statusError);
      }
    }
    return NextResponse.json({ error: "Webhook konnte nicht verarbeitet werden." }, { status: 400 });
  }
}
