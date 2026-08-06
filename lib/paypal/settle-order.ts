import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { inventory, orders, reservations } from "../../db/schema";

export async function settlePaidOrder(db: ReturnType<typeof getDb>, orderId: string, now: string) {
  const rows = await db.select({ reservation: reservations, stock: inventory })
    .from(reservations)
    .innerJoin(inventory, eq(inventory.id, reservations.inventoryId))
    .where(and(eq(reservations.orderId, orderId), eq(reservations.status, "ACTIVE")));

  if (!rows.length) return;

  for (const { reservation } of rows) {
    const reservationResult = await db.batch([db.update(reservations).set({ status: "CONVERTED", releasedAt: now }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, "ACTIVE")))]);
    if (reservationResult[0].meta.changes !== 1) continue;
    await db.batch([db.update(inventory).set({
      reservedQuantity: sql`${inventory.reservedQuantity} - ${reservation.quantity}`,
      soldQuantity: sql`${inventory.soldQuantity} + ${reservation.quantity}`,
      status: sql`CASE WHEN ${inventory.availableQuantity} = 0 THEN 'SOLD' ELSE 'AVAILABLE' END`,
      updatedAt: now,
    }).where(and(eq(inventory.id, reservation.inventoryId), gte(inventory.reservedQuantity, reservation.quantity)))]);
  }
}

export async function releaseOrderReservations(db: ReturnType<typeof getDb>, orderId: string, now: string, status: "RELEASED" | "EXPIRED" = "RELEASED") {
  const rows = await db.select({ reservation: reservations }).from(reservations).where(and(eq(reservations.orderId, orderId), eq(reservations.status, "ACTIVE")));
  if (!rows.length) return 0;
  const quantities = new Map<string, number>();
  for (const { reservation } of rows) quantities.set(reservation.inventoryId, (quantities.get(reservation.inventoryId) ?? 0) + reservation.quantity);
  const writes = [
    ...rows.map(({ reservation }) => db.update(reservations).set({ status, releasedAt: now }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, "ACTIVE")))),
    ...[...quantities.entries()].map(([inventoryId, quantity]) => db.update(inventory).set({ availableQuantity: sql`${inventory.availableQuantity} + ${quantity}`, reservedQuantity: sql`${inventory.reservedQuantity} - ${quantity}`, status: "AVAILABLE", updatedAt: now }).where(and(eq(inventory.id, inventoryId), gte(inventory.reservedQuantity, quantity)))),
    db.update(orders).set({ status: "CANCELLED", updatedAt: now }).where(and(eq(orders.id, orderId), eq(orders.status, "PENDING"))),
  ];
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
  return rows.length;
}

export async function releaseExpiredReservations(db: ReturnType<typeof getDb>, now: string) {
  const expired = await db.select({ orderId: reservations.orderId }).from(reservations).where(and(eq(reservations.status, "ACTIVE"), lte(reservations.expiresAt, now)));
  const orderIds = [...new Set(expired.map((row) => row.orderId).filter((id): id is string => Boolean(id)))];
  for (const orderId of orderIds) await releaseOrderReservations(db, orderId, now, "EXPIRED");
  return orderIds.length;
}
