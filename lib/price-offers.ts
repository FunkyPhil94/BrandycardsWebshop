import { and, eq, inArray, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { priceOffers } from "../db/schema.ts";

type Db = ReturnType<typeof getDb>;

/** How long an accepted offer stays valid. */
export const OFFER_VALIDITY_HOURS = 48;
/** Attempts a customer gets per card. Withdrawn offers do not count. */
export const MAX_OFFERS_PER_PRODUCT = 3;
/** An offer must undercut the list price by at least this much to be worth it. */
export const MIN_DISCOUNT_CENTS = 50;

export function offerExpiry(from = new Date()) {
  return new Date(from.getTime() + OFFER_VALIDITY_HOURS * 3600_000).toISOString();
}

/** Resolves the price a specific customer may pay right now.
 *
 * The negotiated price is never taken from the browser: the checkout sends
 * product ids only, and this lookup decides what each one costs for that user.
 * An offer counts only while it is ACCEPTED and unexpired.
 */
export async function acceptedOfferPrices(db: Db, userId: string, productIds: string[]) {
  const prices = new Map<string, number>();
  if (!productIds.length) return prices;

  const now = new Date().toISOString();
  const rows = await db.select({
    productId: priceOffers.productId,
    amount: priceOffers.proposedAmountCents,
    expiresAt: priceOffers.expiresAt,
  }).from(priceOffers).where(and(
    eq(priceOffers.userId, userId),
    eq(priceOffers.status, "ACCEPTED"),
    inArray(priceOffers.productId, productIds),
  ));

  return pickAcceptedPrices(rows, now);
}

/** The decision itself, separated from the query so it can be tested directly:
 * this is what determines money changing hands.
 *
 * Es gibt sie genau einmal, und das ist der Punkt. Seit dem 2026-08-08 zeigt
 * auch der Checkout den ausgehandelten Preis an — hätte die Anzeige ihre eigene
 * Regel bekommen, könnten beide auseinanderdriften, und der Kunde sähe einen
 * anderen Betrag als den, der abgebucht wird. Das wäre schlechter als gar keine
 * Anzeige. `pickAcceptedPrices` leitet sich deshalb hier ab, statt danebenzustehen.
 */
export function pickAcceptedOffers(
  rows: Array<{ productId: string; amount: number; expiresAt: string | null }>,
  now: string,
) {
  const offers = new Map<string, { amount: number; expiresAt: string }>();
  for (const row of rows) {
    // A missing expiry means the window was never stamped — treat that as not
    // yet valid rather than valid forever, so a half-written row cannot grant
    // an open-ended discount.
    if (!row.expiresAt || row.expiresAt <= now) continue;
    if (!Number.isInteger(row.amount) || row.amount < 1) continue;
    const current = offers.get(row.productId);
    // Several accepted offers on one card should never happen, but if they do
    // the customer gets the better one rather than an arbitrary row.
    if (current === undefined || row.amount < current.amount) offers.set(row.productId, { amount: row.amount, expiresAt: row.expiresAt });
  }
  return offers;
}

/** Dieselbe Entscheidung, nur auf den Betrag verkürzt — für den Bestellweg. */
export function pickAcceptedPrices(
  rows: Array<{ productId: string; amount: number; expiresAt: string | null }>,
  now: string,
) {
  return new Map([...pickAcceptedOffers(rows, now)].map(([productId, offer]) => [productId, offer.amount]));
}

/** Alle angenommenen, noch gültigen Angebote eines Kunden — für die Anzeige im
 *  Checkout. Der verbindliche Preis wird davon **nicht** berührt: Er entsteht
 *  weiterhin allein in `app/api/orders/route.ts` aus `acceptedOfferPrices`. */
export async function acceptedOffersForUser(db: Db, userId: string) {
  const rows = await db.select({
    productId: priceOffers.productId,
    amount: priceOffers.proposedAmountCents,
    expiresAt: priceOffers.expiresAt,
  }).from(priceOffers).where(and(
    eq(priceOffers.userId, userId),
    eq(priceOffers.status, "ACCEPTED"),
  ));
  return pickAcceptedOffers(rows, new Date().toISOString());
}

/** Counts what the customer already tried on this card. */
export async function offerAttempts(db: Db, userId: string, productId: string) {
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(priceOffers)
    .where(and(
      eq(priceOffers.userId, userId),
      eq(priceOffers.productId, productId),
      sql`${priceOffers.status} <> 'WITHDRAWN'`,
    ));
  return Number(rows[0]?.count ?? 0);
}

/** Expires accepted offers whose window has closed. Called from the scheduled
 * worker so a stale discount cannot resurface after the fact. */
export async function expireLapsedOffers(db: Db, now = new Date().toISOString()) {
  const result = await db.update(priceOffers)
    .set({ status: "EXPIRED", updatedAt: now })
    .where(and(
      eq(priceOffers.status, "ACCEPTED"),
      sql`${priceOffers.expiresAt} IS NOT NULL AND ${priceOffers.expiresAt} <= ${now}`,
    ));
  return result;
}
