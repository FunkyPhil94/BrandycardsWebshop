import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orders, payments } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { tryEnqueueAvatarEvent } from "../../../../lib/avatar-events";
import { notifyOrderPaid } from "../../../../lib/email/notify.ts";
import { ebayBestandspruefung } from "../../../../lib/ebay-stock-guard";
import { capturePayPalOrder } from "../../../../lib/paypal/client";
import { assertValidMoney, centsToPayPalValue } from "../../../../lib/paypal/money";
import { releaseOrderReservations, settlePaidOrder } from "../../../../lib/paypal/settle-order";
import { enforcePublicRateLimit, RateLimitError } from "../../../../lib/rate-limit";

type CaptureRequest = { orderId?: unknown; paypalOrderId?: unknown };

function readIds(body: CaptureRequest): { orderId: string; paypalOrderId: string } | null {
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const paypalOrderId = typeof body.paypalOrderId === "string" ? body.paypalOrderId.trim() : "";
  if (!orderId || orderId.length > 64 || !paypalOrderId || paypalOrderId.length > 128) return null;
  return { orderId, paypalOrderId };
}

function captureDetails(payment: { providerCaptureId: string | null }) {
  return { captureId: payment.providerCaptureId, status: "CAPTURED" };
}

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "paypal-capture");
    const appUser = await getAuthenticatedAppUser(request);

    let body: CaptureRequest;
    try {
      body = await request.json() as CaptureRequest;
    } catch {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }
    const ids = readIds(body);
    if (!ids) return NextResponse.json({ error: "Ungültige Zahlungsdaten." }, { status: 400 });

    const db = getDb();
    const order = await db.query.orders.findFirst({ where: eq(orders.id, ids.orderId) });
    const ownerMatches = appUser ? order?.userId === appUser.id : order?.userId === null && Boolean(order?.guestEmail);
    if (!order || !ownerMatches) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
    assertValidMoney(order.totalAmountCents, order.currency);

    const payment = await db.query.payments.findFirst({ where: and(eq(payments.orderId, order.id), eq(payments.provider, "PAYPAL"), eq(payments.providerOrderId, ids.paypalOrderId)) });
    if (!payment) return NextResponse.json({ error: "PayPal-Zahlung gehört nicht zu dieser Bestellung." }, { status: 409 });
    if (payment.amountCents !== order.totalAmountCents || payment.currency !== order.currency) {
      return NextResponse.json({ error: "Zahlungsbetrag konnte nicht verifiziert werden." }, { status: 409 });
    }
    if (payment.status === "CAPTURED") {
      if (order.status === "PENDING") {
        await db.update(orders).set({ status: "PAID", paidAt: order.paidAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(orders.id, order.id), eq(orders.status, "PENDING")));
      }
      await settlePaidOrder(db, order.id, new Date().toISOString());
      await tryEnqueueAvatarEvent(db, {
        eventType: "CARD_SOLD",
        aggregateType: "ORDER",
        aggregateId: order.id,
        dedupeKey: `shop-sale:${order.id}`,
        payload: { orderId: order.id, source: "SHOP" },
      });
      return NextResponse.json({ ok: true, idempotent: true, orderId: order.id, ...captureDetails(payment) });
    }
    if (payment.status !== "CREATED" && payment.status !== "APPROVED") {
      return NextResponse.json({ error: "Zahlung kann nicht eingezogen werden." }, { status: 409 });
    }
    if (order.status !== "PENDING") return NextResponse.json({ error: "Bestellung kann nicht eingezogen werden." }, { status: 409 });

    // Die verbindliche Bestandsprüfung: letzte Gelegenheit, bevor Geld fließt.
    // Bewusst **vor** dem PENDING → PROCESSING-Riegel, damit eine abgelehnte
    // Bestellung nicht in PROCESSING hängenbleibt — aus dem Status käme sie
    // nur von Hand wieder heraus.
    //
    // Der Kunde hat bei PayPal bereits zugestimmt. Abgelehnt wird deshalb mit
    // Klartext und die Reservierung wird freigegeben. Die PayPal-Order bleibt
    // uneingezogen und verfällt von selbst; ein aktives `void` wäre ein
    // weiterer Fremdaufruf mit eigenen Fehlerpfaden für keinen Gewinn.
    const bestandspruefung = await ebayBestandspruefung(db, order.id);
    if (bestandspruefung.meldung) {
      await releaseOrderReservations(db, order.id, new Date().toISOString());
      return NextResponse.json({ error: bestandspruefung.meldung }, { status: 409 });
    }

    const lockResult = await db.batch([db.update(orders).set({ status: "PROCESSING", updatedAt: new Date().toISOString() }).where(and(eq(orders.id, order.id), eq(orders.status, "PENDING")))]);
    if (lockResult[0].meta.changes !== 1) return NextResponse.json({ error: "Die Bestellung wird gerade verarbeitet oder ist abgelaufen." }, { status: 409 });

    const paypalCapture = await capturePayPalOrder(ids.paypalOrderId);
    const capture = paypalCapture.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = capture?.amount;
    if (paypalCapture.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !capture.id || !capturedAmount || capturedAmount.currency_code !== order.currency || capturedAmount.value !== centsToPayPalValue(order.totalAmountCents)) {
      await db.update(orders).set({ status: "PENDING", updatedAt: new Date().toISOString() }).where(and(eq(orders.id, order.id), eq(orders.status, "PROCESSING")));
      return NextResponse.json({ error: "PayPal-Capture konnte nicht verifiziert werden." }, { status: 502 });
    }

    const now = new Date().toISOString();
    // Der Übergang auf CAPTURED ist bewusst **bedingt** geschrieben: Dieselbe
    // Zahlung kann gleichzeitig über den Webhook eintreffen. Wer den Übergang
    // gewinnt (`changes === 1`), verschickt die Bestellbestätigung — so bekommt
    // der Kunde sie genau einmal, ohne dass es dafür eine neue Spalte braucht.
    const captureClaim = await db.batch([db.update(payments)
      .set({ providerCaptureId: capture.id, status: "CAPTURED", rawData: paypalCapture, updatedAt: now })
      .where(and(eq(payments.id, payment.id), inArray(payments.status, ["CREATED", "APPROVED"])))]);
    await db.update(orders).set({ status: "PAID", paidAt: now, updatedAt: now }).where(and(eq(orders.id, order.id), inArray(orders.status, ["PENDING", "PROCESSING"])));
    await settlePaidOrder(db, order.id, now);
    if (captureClaim[0].meta.changes === 1) {
      await tryEnqueueAvatarEvent(db, {
        eventType: "CARD_SOLD",
        aggregateType: "ORDER",
        aggregateId: order.id,
        dedupeKey: `shop-sale:${order.id}`,
        payload: { orderId: order.id, source: "SHOP" },
        createdAt: now,
      });
    }
    if (captureClaim[0].meta.changes === 1) await notifyOrderPaid(db, order.id, bestandspruefung.status);
    return NextResponse.json({ ok: true, idempotent: false, orderId: order.id, captureId: capture.id, status: "CAPTURED" });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("PayPal capture failed", error);
    return NextResponse.json({ error: "PayPal-Zahlung konnte nicht abgeschlossen werden." }, { status: 503 });
  }
}
