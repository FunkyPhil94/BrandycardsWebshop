import { asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayBuyerOffers, ebayListingTraffic, ebayListings, ebayOutbox, syncRuns } from "../../../db/schema";
import { readEbayReadSyncStates } from "../../ebay-read-sync";
import { ebayReadAvailability } from "../ebay-availability";
import { availableAssistantResult, unavailableAssistantResult, type AssistantToolInput, type AssistantToolResult } from "../contracts";
import { assistantTimestamp } from "../time";

const UNRESOLVED_OUTBOX_STATUSES = ["PENDING", "PROCESSING", "RETRY_WAIT", "FAILED"] as const;

/** Die eigenen Angebote nach Aufrufen, absteigend.
 *
 * Gelesen wird die **eigene** Tabelle, nie eBay. Der Assistant hängt damit
 * nicht an einer fremden Antwortzeit, und eine Frage kann eBays Tageskontingent
 * nicht anknabbern — das tut allein der Lesesync, gedrosselt.
 *
 * Angebote ohne gemeldete Aufrufzahl fallen heraus: eine Karte unter
 * „meistgesehen" zu führen, für die eBay `applicable: false` gesagt hat, wäre
 * eine erfundene Null.
 */
export async function getEbayMostViewed(input: AssistantToolInput): Promise<AssistantToolResult<"ebay_most_viewed">> {
  return leseAufrufe("ebay_most_viewed", input);
}

/** Die Gegenfrage: welche Angebote kaum oder gar nicht angesehen wurden.
 *
 * **Der Fehler, der dazu geführt hat.** Der Betreiber meldete am 2026-08-18,
 * dass „welche haben am meisten Aufrufe" und „welche am wenigsten" **dieselbe**
 * Antwort geben. Der Grund stand hier: `orderBy(desc(viewsTotal), …)` war fest
 * verdrahtet, es gab keine Richtung — also konnte die Gegenfrage nirgends
 * hinlaufen als in dieselbe Abfrage.
 *
 * **Der interessante Teil dieser Antwort sind die Nullen.** Früher gemessen: 63
 * von 277 Karten hatten in 30 Tagen keinen einzigen Aufruf. Genau die will diese
 * Frage sehen; sie dürfen nicht wegfallen. Ein `viewsTotal > 0`-Filter wäre hier
 * das Gegenteil einer Antwort.
 */
export async function getEbayLeastViewed(input: AssistantToolInput): Promise<AssistantToolResult<"ebay_least_viewed">> {
  return leseAufrufe("ebay_least_viewed", input);
}

/** Eine Abfrage, zwei Richtungen.
 *
 * Getrennte Funktionen hätten die Verfügbarkeitsprüfung, den Join und die
 * Feldliste verdoppelt — und beim nächsten Feld wäre eine der beiden Fassungen
 * zurückgeblieben. Unterschiedlich ist genau eine Zeile.
 */
async function leseAufrufe<K extends "ebay_most_viewed" | "ebay_least_viewed">(
  tool: K,
  input: AssistantToolInput,
): Promise<AssistantToolResult<K>> {
  const db = getDb();
  const states = await readEbayReadSyncStates(db);
  const availability = ebayReadAvailability(states.get("TRAFFIC"), "Aufrufzahlen");
  if (!availability.available) {
    return unavailableAssistantResult(tool, availability.code, availability.message, ["EBAY_READ_API"]);
  }

  const wenigste = tool === "ebay_least_viewed";
  const rows = await db.select({
    ebayItemId: ebayListingTraffic.ebayItemId,
    rangeStart: ebayListingTraffic.rangeStart,
    rangeEnd: ebayListingTraffic.rangeEnd,
    viewsTotal: ebayListingTraffic.viewsTotal,
    impressionsTotal: ebayListingTraffic.impressionsTotal,
    title: ebayListings.title,
    listingUrl: ebayListings.listingUrl,
  }).from(ebayListingTraffic)
    .leftJoin(ebayListings, eq(ebayListings.ebayItemId, ebayListingTraffic.ebayItemId))
    // `isNotNull` bleibt: „nicht gemeldet" ist keine niedrige Zahl, sondern eine
    // fehlende. Eine Null dagegen ist eine Messung und gehört in die Antwort.
    .where(isNotNull(ebayListingTraffic.viewsTotal))
    .orderBy(
      wenigste ? asc(ebayListingTraffic.viewsTotal) : desc(ebayListingTraffic.viewsTotal),
      desc(ebayListingTraffic.ebayItemId),
    )
    .limit(input.limit);

  return availableAssistantResult(tool, {
    rangeStart: rows[0]?.rangeStart ?? null,
    rangeEnd: rows[0]?.rangeEnd ?? null,
    listings: rows.map((row) => ({
      ebayItemId: row.ebayItemId,
      title: row.title ?? null,
      listingUrl: row.listingUrl ?? null,
      viewsTotal: row.viewsTotal,
      impressionsTotal: row.impressionsTotal,
    })),
  }, ["EBAY_READ_API", "EBAY_CACHE"], availability.freshness);
}

/** Offene Käufer-Preisvorschläge auf eigene eBay-Angebote.
 *
 * Sortiert nach Ablauf, nicht nach Eingang: `BestOfferType` nennt keinen
 * Eingangszeitpunkt (siehe `lib/ebay-read-api.ts`), und der Vorschlag, der
 * zuerst verfällt, ist ohnehin der, der zuerst eine Antwort braucht.
 */
export async function getEbayBuyerOffers(input: AssistantToolInput): Promise<AssistantToolResult<"ebay_buyer_offers">> {
  const db = getDb();
  const states = await readEbayReadSyncStates(db);
  const availability = ebayReadAvailability(states.get("BEST_OFFERS"), "Käufer-Preisvorschläge");
  if (!availability.available) {
    return unavailableAssistantResult("ebay_buyer_offers", availability.code, availability.message, ["EBAY_READ_API"]);
  }

  const rows = await db.select({
    bestOfferId: ebayBuyerOffers.bestOfferId,
    ebayItemId: ebayBuyerOffers.ebayItemId,
    amountCents: ebayBuyerOffers.amountCents,
    currency: ebayBuyerOffers.currency,
    quantity: ebayBuyerOffers.quantity,
    status: ebayBuyerOffers.status,
    hasBuyerMessage: ebayBuyerOffers.hasBuyerMessage,
    expiresAt: ebayBuyerOffers.expiresAt,
    title: ebayListings.title,
    listPriceAmountCents: ebayListings.priceAmountCents,
  }).from(ebayBuyerOffers)
    .leftJoin(ebayListings, eq(ebayListings.ebayItemId, ebayBuyerOffers.ebayItemId))
    .orderBy(sql`datetime(${ebayBuyerOffers.expiresAt})`, ebayBuyerOffers.bestOfferId)
    .limit(input.limit);

  return availableAssistantResult("ebay_buyer_offers", {
    offers: rows.map((row) => ({
      bestOfferId: row.bestOfferId,
      ebayItemId: row.ebayItemId,
      title: row.title ?? null,
      amountCents: row.amountCents,
      listPriceAmountCents: row.listPriceAmountCents ?? null,
      currency: row.currency,
      quantity: row.quantity,
      status: row.status,
      hasBuyerMessage: row.hasBuyerMessage,
      expiresAt: assistantTimestamp(row.expiresAt),
    })),
  }, ["EBAY_READ_API", "EBAY_CACHE"], availability.freshness);
}

export async function getEbaySyncHealth(input: AssistantToolInput): Promise<AssistantToolResult<"ebay_sync_health">> {
  const db = getDb();
  const [[latestRun], [{ unresolvedCount }], unresolvedOutbox, [freshnessRow]] = await Promise.all([
    db.select({
      id: syncRuns.id,
      status: syncRuns.status,
      startedAt: syncRuns.startedAt,
      finishedAt: syncRuns.finishedAt,
      importedCount: syncRuns.importedCount,
      updatedCount: syncRuns.updatedCount,
      deactivatedCount: syncRuns.deactivatedCount,
      failedCount: syncRuns.failedCount,
    }).from(syncRuns).orderBy(desc(sql`datetime(${syncRuns.startedAt})`), desc(syncRuns.id)).limit(1),
    db.select({ unresolvedCount: count() }).from(ebayOutbox)
      .where(inArray(ebayOutbox.status, [...UNRESOLVED_OUTBOX_STATUSES])),
    db.select({
      id: ebayOutbox.id,
      status: ebayOutbox.status,
      operation: ebayOutbox.operation,
      ebayItemId: ebayOutbox.ebayItemId,
      attemptCount: ebayOutbox.attemptCount,
      availableAt: ebayOutbox.availableAt,
    }).from(ebayOutbox)
      .where(inArray(ebayOutbox.status, [...UNRESOLVED_OUTBOX_STATUSES]))
      .orderBy(desc(sql`datetime(${ebayOutbox.createdAt})`), desc(ebayOutbox.id))
      .limit(input.limit),
    db.select({ value: sql<string | null>`max(datetime(${ebayListings.lastSyncedAt}))` }).from(ebayListings),
  ]);

  const dataFreshness = assistantTimestamp(freshnessRow?.value ?? null);
  return availableAssistantResult("ebay_sync_health", {
    latestRun: latestRun ? {
      ...latestRun,
      startedAt: assistantTimestamp(latestRun.startedAt),
      finishedAt: assistantTimestamp(latestRun.finishedAt),
    } : null,
    dataFreshness,
    unresolvedOutboxCount: Number(unresolvedCount ?? 0),
    unresolvedOutbox: unresolvedOutbox.map((job) => ({ ...job, availableAt: assistantTimestamp(job.availableAt) })),
  }, ["SHOP_DB", "EBAY_CACHE"], dataFreshness ?? assistantTimestamp(latestRun?.finishedAt ?? latestRun?.startedAt ?? null));
}
