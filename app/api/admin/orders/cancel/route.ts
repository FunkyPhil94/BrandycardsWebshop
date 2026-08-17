import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { orders } from "../../../../../db/schema";
import { requireAdmin } from "../../../../../lib/admin-access";
import { recordAdminAudit } from "../../../../../lib/admin-audit";
import { releaseOrderReservations } from "../../../../../lib/paypal/settle-order";

/** Storno ist nur vor dem Zahlungseinzug möglich. Nach dem Einzug führt der
 * Admin den PayPal-Erstattungsweg aus; so kann kein Storno Geld und Bestellung
 * auseinanderlaufen lassen. Bestand wird bei einer offenen Reservierung
 * freigegeben, ein eBay-Angebot wird nicht künstlich reaktiviert. */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const body = await request.json() as { orderId?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) return NextResponse.json({ error: "Eine Bestellung fehlt." }, { status: 400 });
    const db = getDb();
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return NextResponse.json({ error: "Unbekannte Bestellung." }, { status: 404 });
    if (order.status === "CANCELLED") return NextResponse.json({ orderId, status: "CANCELLED", idempotent: true });
    if (order.status !== "PENDING") return NextResponse.json({ error: "Nur offene, noch nicht bezahlte Bestellungen können storniert werden. Für bezahlte Bestellungen bitte Erstattung wählen." }, { status: 409 });

    const released = await releaseOrderReservations(db, orderId, new Date().toISOString());
    const current = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (current?.status !== "CANCELLED") return NextResponse.json({ error: "Die Bestellung konnte nicht sicher storniert werden." }, { status: 409 });
    await recordAdminAudit({ request, actorUserId: guard.user.id, action: "order.cancel", entityType: "order", entityId: orderId, metadata: { releasedReservations: released, inventoryReactivated: true, ebayReactivated: false } });
    return NextResponse.json({ orderId, status: "CANCELLED", releasedReservations: released });
  } catch (error) {
    console.error("admin order cancellation failed", error);
    return NextResponse.json({ error: "Bestellung konnte nicht storniert werden." }, { status: 503 });
  }
}
