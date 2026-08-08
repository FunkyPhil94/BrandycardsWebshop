import { and, asc, eq, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { ebayListings, ebayOutbox } from "../db/schema";
import { reviseEbayItemQuantity, withdrawEbayOffer } from "./ebay-client";
import { REVISE_QUANTITY, WITHDRAW_OFFER, bestimmeAuftragsziel, planeEbayRuecknahme } from "./ebay-outbox-plan";

type Db = ReturnType<typeof getDb>;

/** Queues "take this card off eBay" after it sold in the webshop.
 *
 * The decision itself lives in `lib/ebay-outbox-plan.ts` so it can be tested
 * without a database; this function only carries it out.
 */
export async function enqueueEbayWithdraw(db: Db, listingId: string, reason: string) {
  const listing = await db.query.ebayListings.findFirst({ where: eq(ebayListings.id, listingId) });
  if (!listing) {
    console.warn("[ebay-outbox] Listing nicht gefunden; eBay-Angebot wird nicht zurückgenommen.", { listingId, reason });
    return false;
  }

  const plan = planeEbayRuecknahme(listing);
  if (!plan.einreihen) {
    console.warn("[ebay-outbox] Nicht eingereiht.", { listingId, ebayItemId: listing.ebayItemId, grund: plan.grund, reason });
    return false;
  }

  const now = new Date().toISOString();
  await db.insert(ebayOutbox).values({
    aggregateType: "LISTING",
    aggregateId: listing.id,
    ebayItemId: plan.ebayItemId,
    ebayOfferId: plan.ebayOfferId,
    operation: plan.operation,
    payload: { reason, targetQuantity: plan.zielmenge, ebayItemId: plan.ebayItemId },
    dedupeKey: plan.dedupeKey,
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

/** Carries out one queued job. Which call to make is decided in the plan module. */
async function runJob(job: { operation: string; ebayItemId: string | null; ebayOfferId: string | null }) {
  const ziel = bestimmeAuftragsziel(job);
  if (ziel.aufruf === REVISE_QUANTITY) return reviseEbayItemQuantity(ziel.ebayItemId, ziel.menge);
  if (ziel.aufruf === WITHDRAW_OFFER) return withdrawEbayOffer(ziel.ebayOfferId);
  throw new Error("Unerreichbar: unbekanntes Auftragsziel.");
}

export async function processEbayOutbox(db: Db = getDb()) {
  if (process.env.EBAY_WRITE_ENABLED !== "true") return 0;
  let processed = 0;
  for (let i = 0; i < 10; i += 1) {
    const job = await claimNext(db);
    if (!job) break;
    try {
      const ergebnis = await runJob(job);
      // Welcher Weg es war, gehört ins Protokoll. `SUCCEEDED` allein
      // unterscheidet nicht zwischen „eBay hat die Menge geändert" und „eBay
      // meldete bereits beendet, und unsere Fehlernummern haben gegriffen" —
      // beim Abnahmetest am 2026-08-08 war deshalb nicht feststellbar, welcher
      // Fall eingetreten war. Die Nummern in ALREADY_ENDED_CODES sind geraten;
      // diese Zeile ist die einzige Stelle, an der sie sich bestätigen lassen.
      console.log("[ebay-outbox] Auftrag erledigt.", { jobId: job.id, operation: job.operation, ebayItemId: job.ebayItemId, ergebnis: ergebnis ?? "OHNE_RUECKMELDUNG" });
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
