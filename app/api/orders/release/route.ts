import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { releaseOrderReservations } from "../../../../lib/paypal/settle-order";

export async function POST(request: Request) {
  const user = await getAuthenticatedAppUser(request);
  if (!user) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  const body = await request.json() as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId || orderId.length > 64) return NextResponse.json({ error: "Ungültige Bestellung." }, { status: 400 });
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.userId, user.id)) });
  if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  const released = await releaseOrderReservations(db, order.id, new Date().toISOString());
  return NextResponse.json({ ok: true, released });
}
