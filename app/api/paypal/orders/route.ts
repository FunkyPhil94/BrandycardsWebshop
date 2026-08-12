import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orderItems, orders, payments } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { ebaySoldOutMessage } from "../../../../lib/ebay-stock-guard";
import { createPayPalOrder } from "../../../../lib/paypal/client";
import { assertValidMoney } from "../../../../lib/paypal/money";
import { releaseOrderReservations } from "../../../../lib/paypal/settle-order";
import { enforcePublicRateLimit, RateLimitError } from "../../../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "paypal-orders");
    const appUser = await getAuthenticatedAppUser(request);
    const body = await request.json() as { orderId?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId || orderId.length > 64) return NextResponse.json({ error: "Ungültige Bestellung." }, { status: 400 });

    const db = getDb();
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    const ownerMatches = appUser ? order?.userId === appUser.id : order?.userId === null && Boolean(order?.guestEmail);
    if (!order || !ownerMatches || order.status !== "PENDING") return NextResponse.json({ error: "Bestellung nicht verfügbar." }, { status: 409 });
    const items = await db.select({ quantity: orderItems.quantity, totalAmountCents: orderItems.totalAmountCents }).from(orderItems).where(eq(orderItems.orderId, order.id));
    if (!items.length || items.some((item) => item.quantity < 1 || item.totalAmountCents < 1)) return NextResponse.json({ error: "Bestellung enthält keine gültigen Artikel." }, { status: 409 });
    const calculatedSubtotal = items.reduce((sum, item) => sum + item.totalAmountCents, 0);
    const calculatedTotal = calculatedSubtotal + order.shippingAmountCents;
    if (calculatedSubtotal !== order.subtotalAmountCents || calculatedTotal !== order.totalAmountCents) return NextResponse.json({ error: "Bestellbetrag konnte nicht verifiziert werden." }, { status: 409 });
    assertValidMoney(order.totalAmountCents, order.currency);

    // Erste von zwei Bestandsprüfungen gegen eBay. Hier ist sie die
    // freundliche: Der Kunde erfährt vor dem Gang zu PayPal, dass die Karte
    // weg ist, statt danach. Die verbindliche sitzt im Capture.
    const soldOut = await ebaySoldOutMessage(db, order.id);
    if (soldOut) {
      await releaseOrderReservations(db, order.id, new Date().toISOString());
      return NextResponse.json({ error: soldOut }, { status: 409 });
    }

    const existingPayment = await db.query.payments.findFirst({ where: and(eq(payments.orderId, order.id), eq(payments.provider, "PAYPAL")) });
    if (existingPayment?.status === "CAPTURED") return NextResponse.json({ error: "Diese Bestellung wurde bereits bezahlt." }, { status: 409 });
    if (existingPayment?.providerOrderId && ["CREATED", "APPROVED"].includes(existingPayment.status)) return NextResponse.json({ error: "Für diese Bestellung wurde bereits eine PayPal-Zahlung gestartet." }, { status: 409 });

    const origin = new URL(request.url).origin;
    const paypalOrder = await createPayPalOrder({ referenceId: order.id, amountCents: order.totalAmountCents, currency: order.currency, returnUrl: `${origin}/checkout/paypal/success`, cancelUrl: `${origin}/checkout/paypal/cancel` });
    if (!paypalOrder.id) throw new Error("PayPal lieferte keine Order-ID.");
    const now = new Date().toISOString();
    if (existingPayment) {
      await db.update(payments).set({
        providerOrderId: paypalOrder.id,
        status: "CREATED",
        amountCents: order.totalAmountCents,
        currency: order.currency,
        updatedAt: now,
      }).where(eq(payments.id, existingPayment.id));
    } else {
      await db.insert(payments).values({
        orderId: order.id,
        provider: "PAYPAL",
        providerOrderId: paypalOrder.id,
        status: "CREATED",
        amountCents: order.totalAmountCents,
        currency: order.currency,
        createdAt: now,
        updatedAt: now,
      });
    }
    return NextResponse.json({ id: paypalOrder.id, status: paypalOrder.status, links: paypalOrder.links ?? [] });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("PayPal order creation failed", error);
    return NextResponse.json({ error: "PayPal ist derzeit nicht verfügbar." }, { status: 503 });
  }
}
