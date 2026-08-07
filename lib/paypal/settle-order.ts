import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { ebayListings, inventory, orders, reservations } from "../../db/schema";
import { enqueueEbayWithdraw } from "../ebay-outbox";

export async function settlePaidOrder(db: ReturnType<typeof getDb>, orderId: string, now: string) {
  const rows = await db.select({ reservation: reservations, stock: inventory, listing: ebayListings })
    .from(reservations)
    .innerJoin(inventory, eq(inventory.id, reservations.inventoryId))
    .leftJoin(ebayListings, eq(ebayListings.productId, reservations.productId))
    .where(and(eq(reservations.orderId, orderId), eq(reservations.status, "ACTIVE")));

  if (!rows.length) return;

  for (const { reservation, listing } of rows) {
    const reservationResult = await db.batch([db.update(reservations).set({ status: "CONVERTED", releasedAt: now }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, "ACTIVE")))]);
    if (reservationResult[0].meta.changes !== 1) continue;
    const inventoryResult = await db.batch([db.update(inventory).set({
      reservedQuantity: sql`${inventory.reservedQuantity} - ${reservation.quantity}`,
      soldQuantity: sql`${inventory.soldQuantity} + ${reservation.quantity}`,
      status: sql`CASE WHEN ${inventory.availableQuantity} = 0 THEN 'SOLD' ELSE 'AVAILABLE' END`,
      updatedAt: now,
    }).where(and(eq(inventory.id, reservation.inventoryId), gte(inventory.reservedQuantity, reservation.quantity)))]);
    if (inventoryResult[0].meta.changes !== 1) {
      await db.batch([db.update(reservations).set({ status: "ACTIVE", releasedAt: null }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, "CONVERTED")))]);
      continue;
    }
    if (listing) await enqueueEbayWithdraw(db, listing.id, "Webshop-Bestellung bezahlt");
  }
}

export async function releaseOrderReservations(db: ReturnType<typeof getDb>, orderId: string, now: string, status: "RELEASED" | "EXPIRED" = "RELEASED") {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.status === "PROCESSING" || !["PENDING", "CANCELLED"].includes(order.status)) return 0;
  if (order.status === "PENDING") {
    const claim = await db.batch([db.update(orders).set({ status: "CANCELLED", updatedAt: now }).where(and(eq(orders.id, orderId), eq(orders.status, "PENDING")))]);
    if (claim[0].meta.changes !== 1) return 0;
  }
  const rows = await db.select({ reservation: reservations }).from(reservations).where(and(eq(reservations.orderId, orderId), eq(reservations.status, "ACTIVE")));
  if (!rows.length) return 0;
  const quantities = new Map<string, number>();
  for (const { reservation } of rows) quantities.set(reservation.inventoryId, (quantities.get(reservation.inventoryId) ?? 0) + reservation.quantity);
  const writes = [
    ...rows.map(({ reservation }) => db.update(reservations).set({ status, releasedAt: now }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, "ACTIVE")))),
    ...[...quantities.entries()].map(([inventoryId, quantity]) => db.update(inventory).set({ availableQuantity: sql`${inventory.availableQuantity} + ${quantity}`, reservedQuantity: sql`${inventory.reservedQuantity} - ${quantity}`, status: "AVAILABLE", updatedAt: now }).where(and(eq(inventory.id, inventoryId), gte(inventory.reservedQuantity, quantity)))),
  ];
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
  return rows.length;
}

/** Frees reservations whose window has closed.
 *
 * `userId` narrows the sweep to one customer. The checkout uses that before
 * creating an order, so a customer's own lapsed holds come back immediately
 * instead of waiting for the next scheduled run — which, at an hourly cron and
 * a fifteen minute window, could be another 45 minutes away. See
 * docs/security-findings.md, SEC-03.
 */
export async function releaseExpiredReservations(db: ReturnType<typeof getDb>, now: string, userId?: string) {
  const lapsed = and(eq(reservations.status, "ACTIVE"), lte(reservations.expiresAt, now));
  const expired = await db.select({ orderId: reservations.orderId }).from(reservations)
    .where(userId ? and(lapsed, eq(reservations.userId, userId)) : lapsed);
  const orderIds = [...new Set(expired.map((row) => row.orderId).filter((id): id is string => Boolean(id)))];
  for (const orderId of orderIds) await releaseOrderReservations(db, orderId, now, "EXPIRED");
  return orderIds.length;
}

/** Units of stock a customer is currently holding in unpaid orders. */
export async function reservedUnitsForUser(db: ReturnType<typeof getDb>, userId: string) {
  const [row] = await db.select({ total: sql<number>`COALESCE(SUM(${reservations.quantity}), 0)` })
    .from(reservations)
    .where(and(eq(reservations.userId, userId), eq(reservations.status, "ACTIVE")));
  return Number(row?.total ?? 0);
}
