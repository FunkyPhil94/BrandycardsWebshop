import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { inventory, reservations } from "../../db/schema";

export async function settlePaidOrder(db: ReturnType<typeof getDb>, orderId: string, now: string) {
  const rows = await db.select({ reservation: reservations, stock: inventory })
    .from(reservations)
    .innerJoin(inventory, eq(inventory.id, reservations.inventoryId))
    .where(and(eq(reservations.orderId, orderId), eq(reservations.status, "ACTIVE")));

  if (!rows.length) return;

  const writes = [
    ...rows.map(({ reservation }) => db.update(reservations).set({ status: "CONVERTED", releasedAt: now }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, "ACTIVE")))),
    ...rows.map(({ reservation }) => db.update(inventory).set({
      reservedQuantity: sql`${inventory.reservedQuantity} - ${reservation.quantity}`,
      soldQuantity: sql`${inventory.soldQuantity} + ${reservation.quantity}`,
      status: sql`CASE WHEN ${inventory.availableQuantity} = 0 THEN 'SOLD' ELSE 'AVAILABLE' END`,
      updatedAt: now,
    }).where(and(eq(inventory.id, reservation.inventoryId), gte(inventory.reservedQuantity, reservation.quantity)))),
  ];
  await db.batch(writes as any);
}
