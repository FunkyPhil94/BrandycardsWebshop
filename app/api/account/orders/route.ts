import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orderItems, orders, payments } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { D1_SAFE_ID_LIST } from "../../../../lib/d1-limits";
import { shippingCarrierLabel, trackingUrl } from "../../../../lib/shipping";
import { enforcePublicRateLimit, RateLimitError } from "../../../../lib/rate-limit";

type Address = { name: string; street: string; postalCode: string; city: string; country: string };

function address(value: unknown): Address | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const field = (name: string) => typeof raw[name] === "string" ? raw[name].trim() : "";
  const parsed = { name: field("name"), street: field("street"), postalCode: field("postalCode"), city: field("city"), country: field("country") };
  return parsed.name && parsed.street && parsed.postalCode && parsed.city && parsed.country ? parsed : null;
}

async function inChunks<Row>(ids: string[], query: (ids: string[]) => Promise<Row[]>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let index = 0; index < ids.length; index += D1_SAFE_ID_LIST) rows.push(...await query(ids.slice(index, index + D1_SAFE_ID_LIST)));
  return rows;
}

/** Eigene Bestellhistorie. Die User-ID kommt ausschließlich aus dem
 * authentifizierten Supabase-Token; eine fremde orderId wird nicht akzeptiert. */
export async function GET(request: Request) {
  try {
    await enforcePublicRateLimit(request, "account-orders");
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });

    const db = getDb();
    const rows = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      currency: orders.currency,
      subtotalAmountCents: orders.subtotalAmountCents,
      shippingAmountCents: orders.shippingAmountCents,
      totalAmountCents: orders.totalAmountCents,
      shippingAddress: orders.shippingAddress,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      shippedAt: orders.shippedAt,
      shippingCarrier: orders.shippingCarrier,
      trackingNumber: orders.trackingNumber,
      completedAt: orders.completedAt,
      cancelledAt: orders.cancelledAt,
      refundedAt: orders.refundedAt,
    }).from(orders).where(eq(orders.userId, appUser.id)).orderBy(desc(orders.createdAt), desc(orders.id));
    const ids = rows.map((row) => row.id);
    if (!ids.length) return NextResponse.json({ orders: [] }, { headers: { "cache-control": "no-store" } });

    const [items, paymentRows] = await Promise.all([
      inChunks(ids, (chunk) => db.select({ orderId: orderItems.orderId, title: orderItems.titleSnapshot, quantity: orderItems.quantity, unitAmountCents: orderItems.unitAmountCents, totalAmountCents: orderItems.totalAmountCents }).from(orderItems).where(inArray(orderItems.orderId, chunk))),
      inChunks(ids, (chunk) => db.select({ orderId: payments.orderId, provider: payments.provider, status: payments.status, amountCents: payments.amountCents, currency: payments.currency, createdAt: payments.createdAt }).from(payments).where(inArray(payments.orderId, chunk))),
    ]);

    return NextResponse.json({
      orders: rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        currency: row.currency,
        subtotalAmountCents: row.subtotalAmountCents,
        shippingAmountCents: row.shippingAmountCents,
        totalAmountCents: row.totalAmountCents,
        shippingAddress: address(row.shippingAddress),
        createdAt: row.createdAt,
        paidAt: row.paidAt,
        shippedAt: row.shippedAt,
        shippingCarrier: shippingCarrierLabel(row.shippingCarrier),
        trackingNumber: row.trackingNumber,
        trackingUrl: trackingUrl(row.shippingCarrier, row.trackingNumber),
        completedAt: row.completedAt,
        cancelledAt: row.cancelledAt,
        refundedAt: row.refundedAt,
        items: items.filter((item) => item.orderId === row.id),
        payments: paymentRows.filter((payment) => payment.orderId === row.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
      })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    console.error("Account orders lookup failed", error);
    return NextResponse.json({ error: "Bestellungen konnten nicht geladen werden." }, { status: 503 });
  }
}
