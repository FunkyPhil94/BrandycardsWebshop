import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { releaseOrderReservations } from "../../../../lib/paypal/settle-order";

export async function POST(request: Request) {
  const user = await getAuthenticatedAppUser(request);

  const body = await request.json() as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId || orderId.length > 64) return NextResponse.json({ error: "Ungültige Bestellung." }, { status: 400 });
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  const ownerMatches = user ? order?.userId === user.id : order?.userId === null && Boolean(order?.guestEmail);
  if (!order || !ownerMatches) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  const released = await releaseOrderReservations(db, order.id, new Date().toISOString());
  return NextResponse.json({ ok: true, released });
}
