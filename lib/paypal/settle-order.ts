import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { ebayListings, inventory, orderItems, orders, reservations } from "../../db/schema";
import { enqueueEbayWithdraw, processEbayOutbox } from "../ebay-outbox";

export async function settlePaidOrder(db: ReturnType<typeof getDb>, orderId: string, now: string) {
  const rows = await db.select({ reservation: reservations, stock: inventory, listing: ebayListings })
    .from(reservations)
    .innerJoin(inventory, eq(inventory.id, reservations.inventoryId))
    .leftJoin(ebayListings, eq(ebayListings.productId, reservations.productId))
    .where(and(eq(reservations.orderId, orderId), eq(reservations.status, "ACTIVE")));

  if (!rows.length) return;

  let eingereiht = false;
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
    if (listing) eingereiht = await enqueueEbayWithdraw(db, listing.id, "Webshop-Bestellung bezahlt") || eingereiht;
  }

  // **Sofort ausführen, nicht auf den geplanten Lauf warten.** Sonst bliebe die
  // verkaufte Karte bis zum nächsten Schlag bei eBay im Angebot — bei einem
  // 3-Minuten-Takt also bis zu drei Minuten, in denen ein eBay-Käufer dieselbe
  // Einzelkarte kaufen kann. Das ist die Richtung, die beim Storno den
  // Verkäuferstatus kostet.
  //
  // **Mit eigener, kurzer Zeitgrenze**, denn hier wartet ein Kunde auf seine
  // Kaufbestätigung. Die 30 Sekunden des Importlaufs wären an dieser Stelle
  // unzumutbar; 5 Sekunden reichen für einen Aufruf, der sonst in
  // Millisekunden antwortet.
  //
  // `cloudflare:workers` stellt **kein** `waitUntil` bereit — nachgeprüft, es
  // gibt dort nur `env`. Und eine Zusage einfach ohne `await` zu feuern wäre
  // schlimmer als warten: Die Laufzeitumgebung bricht sie ab, sobald die
  // Antwort steht, und der Auftrag bliebe halb erledigt liegen.
  //
  // Der geplante Lauf bleibt das Netz: Was hier scheitert oder in die
  // Zeitgrenze läuft, holt er nach — die Zeile steht dann auf RETRY_WAIT.
  if (eingereiht) {
    await processEbayOutbox(db, { timeoutMs: 5_000, maxJobs: 3 }).catch((error: unknown) => {
      console.error("[settle-order] Sofortige eBay-Rücknahme fehlgeschlagen, der geplante Lauf holt es nach.",
        { orderId, fehler: error instanceof Error ? error.message : error });
    });
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
export async function releaseExpiredReservations(db: ReturnType<typeof getDb>, now: string, userId?: string, guestEmail?: string) {
  const lapsed = and(eq(reservations.status, "ACTIVE"), lte(reservations.expiresAt, now));
  const owner = userId ? eq(reservations.userId, userId) : guestEmail ? eq(reservations.guestEmail, guestEmail) : null;
  const expired = await db.select({ orderId: reservations.orderId }).from(reservations)
    .where(owner ? and(lapsed, owner) : lapsed);
  const orderIds = [...new Set(expired.map((row) => row.orderId).filter((id): id is string => Boolean(id)))];
  for (const orderId of orderIds) await releaseOrderReservations(db, orderId, now, "EXPIRED");
  return orderIds.length;
}

/** Die Karten einer Bestellung mit ihrer eBay-ItemID, für die Bestandsprüfung
 *  vor der Zahlung. `ebayItemId` bleibt null, wenn es kein Listing (mehr) gibt
 *  — solche Positionen werden von der Prüfung übersprungen. */
export async function orderCardsForStockCheck(db: ReturnType<typeof getDb>, orderId: string) {
  const rows = await db.select({
    title: orderItems.titleSnapshot,
    quantity: orderItems.quantity,
    ebayItemId: ebayListings.ebayItemId,
  }).from(orderItems)
    .leftJoin(ebayListings, eq(ebayListings.productId, orderItems.productId))
    .where(eq(orderItems.orderId, orderId));
  return rows.map((row) => ({ title: row.title, quantity: row.quantity, ebayItemId: row.ebayItemId ?? null }));
}

/** Units of stock a customer is currently holding in unpaid orders. */
export async function reservedUnitsForUser(db: ReturnType<typeof getDb>, userId: string) {
  const [row] = await db.select({ total: sql<number>`COALESCE(SUM(${reservations.quantity}), 0)` })
    .from(reservations)
    .where(and(eq(reservations.userId, userId), eq(reservations.status, "ACTIVE")));
  return Number(row?.total ?? 0);
}

/** Units a guest currently holds, identified by the confirmation email. */
export async function reservedUnitsForGuest(db: ReturnType<typeof getDb>, guestEmail: string) {
  const [row] = await db.select({ total: sql<number>`COALESCE(SUM(${reservations.quantity}), 0)` })
    .from(reservations)
    .where(and(eq(reservations.guestEmail, guestEmail), eq(reservations.status, "ACTIVE")));
  return Number(row?.total ?? 0);
}
