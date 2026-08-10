import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { orders, payments } from "../../../../../db/schema";
import { requireAdmin } from "../../../../../lib/admin-access";
import { recordAdminAudit } from "../../../../../lib/admin-audit";
import { notifyOrderRefunded } from "../../../../../lib/email/notify.ts";
import { refundPayPalCapture } from "../../../../../lib/paypal/client";

/** Vollständige Erstattung über PayPal. Der Shop setzt den Status erst nach
 * erfolgreicher Anbieterantwort. Bestand und eBay-Angebot werden bewusst nicht
 * automatisch reaktiviert: Eine Retoure muss geprüft und die Karte physisch
 * wieder vorhanden sein, bevor sie erneut angeboten werden darf. */
export async function POST(request: Request) {
  const guard = await requireAdmin(request, { recentAuthSeconds: 600 });
  if (guard.response) return guard.response;

  try {
    const body = await request.json() as { orderId?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) return NextResponse.json({ error: "Eine Bestellung fehlt." }, { status: 400 });
    const db = getDb();
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return NextResponse.json({ error: "Unbekannte Bestellung." }, { status: 404 });
    const payment = await db.query.payments.findFirst({ where: and(eq(payments.orderId, orderId), eq(payments.provider, "PAYPAL")), orderBy: [desc(payments.createdAt)] });
    if (!payment) return NextResponse.json({ error: "Für diese Bestellung wurde keine PayPal-Zahlung gefunden." }, { status: 409 });
    if (order.status === "REFUNDED" && payment.status === "REFUNDED") return NextResponse.json({ orderId, status: "REFUNDED", idempotent: true });
    if (!["PAID", "SHIPPED", "COMPLETED"].includes(order.status)) return NextResponse.json({ error: "Nur bezahlte Bestellungen können erstattet werden." }, { status: 409 });
    if (payment.status === "REFUNDED") return NextResponse.json({ orderId, status: "REFUNDED", idempotent: true });
    if (payment.status !== "CAPTURED" || !payment.providerCaptureId) return NextResponse.json({ error: "Die PayPal-Zahlung ist noch nicht vollständig eingezogen oder hat keine Capture-ID." }, { status: 409 });
    if (payment.amountCents !== order.totalAmountCents || payment.currency !== order.currency) return NextResponse.json({ error: "Zahlungsbetrag und Bestellung stimmen nicht überein." }, { status: 409 });

    const refund = await refundPayPalCapture(payment.providerCaptureId);
    const now = new Date().toISOString();
    await db.update(payments).set({ status: "REFUNDED", rawData: refund, updatedAt: now }).where(and(eq(payments.id, payment.id), eq(payments.status, "CAPTURED")));
    await db.update(orders).set({ status: "REFUNDED", refundedAt: now, updatedAt: now }).where(and(eq(orders.id, orderId), eq(orders.status, order.status)));
    await recordAdminAudit({ request, actorUserId: guard.user.id, action: "order.refund", entityType: "order", entityId: orderId, metadata: { amountCents: order.totalAmountCents, currency: order.currency, inventoryReactivated: false, ebayReactivated: false } });
    await notifyOrderRefunded(db, orderId);
    return NextResponse.json({ orderId, status: "REFUNDED", amountCents: order.totalAmountCents, currency: order.currency });
  } catch (error) {
    console.error("admin order refund failed", error);
    return NextResponse.json({ error: "Erstattung konnte nicht ausgeführt werden. Bitte PayPal und den Auftrag prüfen." }, { status: 503 });
  }
}
