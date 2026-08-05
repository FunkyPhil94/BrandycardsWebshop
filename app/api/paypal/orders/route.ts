import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { createPayPalOrder } from "../../../../lib/paypal/client";
import { assertValidMoney } from "../../../../lib/paypal/money";

export async function POST(request: Request) {
  try {
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
    const body = await request.json() as { orderId?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId || orderId.length > 64) return NextResponse.json({ error: "Ungültige Bestellung." }, { status: 400 });

    const db = getDb();
    const order = await db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.userId, appUser.id)) });
    if (!order || order.status !== "PENDING") return NextResponse.json({ error: "Bestellung nicht verfügbar." }, { status: 409 });
    const items = await db.select({ quantity: orderItems.quantity, totalAmountCents: orderItems.totalAmountCents }).from(orderItems).where(eq(orderItems.orderId, order.id));
    if (!items.length || items.some((item) => item.quantity < 1 || item.totalAmountCents < 1)) return NextResponse.json({ error: "Bestellung enthält keine gültigen Artikel." }, { status: 409 });
    const calculatedSubtotal = items.reduce((sum, item) => sum + item.totalAmountCents, 0);
    const calculatedTotal = calculatedSubtotal + order.shippingAmountCents;
    if (calculatedSubtotal !== order.subtotalAmountCents || calculatedTotal !== order.totalAmountCents) return NextResponse.json({ error: "Bestellbetrag konnte nicht verifiziert werden." }, { status: 409 });
    assertValidMoney(order.totalAmountCents, order.currency);

    const origin = new URL(request.url).origin;
    const paypalOrder = await createPayPalOrder({ referenceId: order.id, amountCents: order.totalAmountCents, currency: order.currency, returnUrl: `${origin}/checkout/paypal/success`, cancelUrl: `${origin}/checkout/paypal/cancel` });
    return NextResponse.json({ id: paypalOrder.id, status: paypalOrder.status, links: paypalOrder.links ?? [] });
  } catch (error) {
    console.error("PayPal order creation failed", error);
    return NextResponse.json({ error: "PayPal ist derzeit nicht verfügbar." }, { status: 503 });
  }
}
