import { and, asc, eq, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { ebayListings, ebayOutbox } from "../db/schema";
import { withdrawEbayOffer } from "./ebay-client";

type Db = ReturnType<typeof getDb>;

export async function enqueueEbayWithdraw(db: Db, listingId: string, reason: string) {
  const listing = await db.query.ebayListings.findFirst({ where: eq(ebayListings.id, listingId) });
  // Trading API imports carry no Inventory API offerId, so no withdraw job can
  // be queued. The listing then stays live on eBay after a paid webshop order,
  // which risks a double sale. Log it so the gap is visible in production.
  if (!listing?.ebayOfferId) {
    console.warn("[ebay-outbox] Kein ebayOfferId vorhanden; eBay-Angebot wird nicht beendet.", { listingId, ebayItemId: listing?.ebayItemId ?? null, reason });
    return false;
  }

  const now = new Date().toISOString();
  const dedupeKey = `listing:${listing.id}:withdraw:${listing.ebayOfferId}`;
  await db.insert(ebayOutbox).values({
    aggregateType: "LISTING",
    aggregateId: listing.id,
    ebayItemId: listing.ebayItemId,
    ebayOfferId: listing.ebayOfferId,
    operation: "WITHDRAW_OFFER",
    payload: { reason, targetQuantity: 0, ebayOfferId: listing.ebayOfferId },
    dedupeKey,
    status: "PENDING",
    availableAt: now,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing({ target: ebayOutbox.dedupeKey });
  return true;
}

async function claimNext(db: Db) {
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const candidate = await db.select().from(ebayOutbox)
    .where(and(
      or(eq(ebayOutbox.status, "PENDING"), eq(ebayOutbox.status, "RETRY_WAIT"), and(eq(ebayOutbox.status, "PROCESSING"), lte(ebayOutbox.lockedAt, stale))),
      lte(ebayOutbox.availableAt, now),
    ))
    .orderBy(asc(ebayOutbox.availableAt), asc(ebayOutbox.createdAt))
    .limit(1);
  const job = candidate[0];
  if (!job) return null;
  const result = await db.batch([db.update(ebayOutbox).set({ status: "PROCESSING", lockedAt: now, lastAttemptAt: now, attemptCount: sql`${ebayOutbox.attemptCount} + 1`, updatedAt: now }).where(and(eq(ebayOutbox.id, job.id), or(eq(ebayOutbox.status, "PENDING"), eq(ebayOutbox.status, "RETRY_WAIT"), and(eq(ebayOutbox.status, "PROCESSING"), lte(ebayOutbox.lockedAt, stale)))))]);
  return result[0].meta.changes === 1 ? { ...job, attemptCount: job.attemptCount + 1 } : null;
}

export async function processEbayOutbox(db: Db = getDb()) {
  if (process.env.EBAY_WRITE_ENABLED !== "true") return 0;
  let processed = 0;
  for (let i = 0; i < 10; i += 1) {
    const job = await claimNext(db);
    if (!job) break;
    try {
      if (!job.ebayOfferId || job.operation !== "WITHDRAW_OFFER") throw new Error("eBay-Outbox-Auftrag ist unvollständig.");
      await withdrawEbayOffer(job.ebayOfferId);
      const now = new Date().toISOString();
      await db.update(ebayOutbox).set({ status: "SUCCEEDED", succeededAt: now, lockedAt: null, lastError: null, updatedAt: now }).where(eq(ebayOutbox.id, job.id));
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter eBay-Outbox-Fehler";
      const retry = job.attemptCount < 5;
      const next = new Date(Date.now() + Math.min(60, 5 * 2 ** Math.max(0, job.attemptCount - 1)) * 60_000).toISOString();
      await db.update(ebayOutbox).set({ status: retry ? "RETRY_WAIT" : "FAILED", availableAt: next, lockedAt: null, lastError: message, updatedAt: new Date().toISOString() }).where(eq(ebayOutbox.id, job.id));
    }
  }
  return processed;
}
