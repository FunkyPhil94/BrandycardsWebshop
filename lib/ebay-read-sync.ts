/** Der Lesesync für die drei eBay-Quellen der Phase 8.
 *
 * Er ruft ab, legt ab, und schreibt nach jedem Versuch in `ebay_read_syncs`,
 * wie er ausgegangen ist. Nach eBay schreibt er nichts — dieses Modul kennt
 * keinen einzigen verändernden Aufruf.
 *
 * **Zwei Eigenschaften, auf die sich der Assistant verlässt:**
 *
 * 1. *Idempotenz durch Fensterschreibweise.* Ein Lauf stempelt jede Zeile, die
 *    er schreibt, mit derselben Uhrzeit und löscht danach alles mit
 *    abweichendem Stempel. Zweimal derselbe eBay-Inhalt ergibt denselben
 *    Tabelleninhalt — auch dann, wenn der erste Lauf mittendrin abbrach.
 * 2. *Ein Fehlschlag löscht nie.* Erst wird vollständig abgerufen, dann
 *    geschrieben. Ein eBay-Ausfall lässt den letzten guten Stand stehen und
 *    vermerkt nur, dass er alt ist.
 */

import { eq, inArray, ne, sql } from "drizzle-orm";
import type { getDb } from "../db/index.ts";
import {
  ebayBuyerOffers,
  ebayInboxMessages,
  ebayListingTraffic,
  ebayReadSyncs,
  ebaySales,
  ebayListings,
  type EbayReadDataType,
  type EbayReadSyncStatus,
} from "../db/schema.ts";
import { maxInsertRows } from "./d1-limits.ts";
import {
  EbayReadError,
  boundedDetail,
  fetchEbayBuyerOffers,
  fetchEbayInboxMessages,
  fetchEbayListingTraffic,
  fetchEbaySales,
  trafficWindow,
  type EbayBuyerOffer,
  type EbayInboxMessage,
  type EbaySaleRecord,
  type EbayTrafficReport,
} from "./ebay-read-api.ts";
import { parseDbTimestamp } from "./retention.ts";

type Db = ReturnType<typeof getDb>;

/** Wie oft der Lesesync höchstens läuft.
 *
 * **Nicht im Cron-Takt.** Der Zeitplan feuert alle drei Minuten; zwei
 * zusätzliche Trading-Aufrufe je Schlag wären 960 Aufrufe am Tag aus genau dem
 * Topf von 5 000, aus dem sich auch Kasse, Beschreibungsabfrage und Rücknahme
 * bedienen (siehe `tests/ebay-stock-check.test.mjs`). Bei 15 Minuten sind es
 * 192 — die Fragen „gibt es neue Nachrichten?" und „neue Vorschläge?" werden
 * dadurch nicht schlechter beantwortet, ein blockierter Checkout schon.
 */
export const EBAY_READ_SYNC_INTERVAL_MS = 15 * 60_000;

/** Frist nach einem Fehler, den kein Wiederholungsversuch behebt.
 *
 * Ein fehlender OAuth-Scope geht nicht von selbst weg — dafür muss der
 * Kontoinhaber erneut zustimmen. Alle 15 Minuten dagegenzulaufen kostet nur
 * Tokenanfragen. Sechs Stunden sind lang genug, um nicht zu nerven, und kurz
 * genug, dass eine frische Zustimmung am selben Tag greift.
 */
export const EBAY_READ_SYNC_BLOCKED_BACKOFF_MS = 6 * 60 * 60_000;

export type EbayReadSyncRow = {
  status: EbayReadSyncStatus;
  lastAttemptAt: string | null;
};

/** Ist dieser Datentyp wieder dran?
 *
 * Rein und ohne Datenbank, damit die Drosselung ohne D1 prüfbar ist. Eine
 * unlesbare Zeitangabe gilt als „lange her": Lieber ein Abruf zu viel als eine
 * Quelle, die wegen eines kaputten Zeitstempels nie wieder anläuft.
 */
export function isEbayReadSyncDue(
  row: EbayReadSyncRow | undefined,
  now: Date = new Date(),
  intervalMs: number = EBAY_READ_SYNC_INTERVAL_MS,
  blockedBackoffMs: number = EBAY_READ_SYNC_BLOCKED_BACKOFF_MS,
): boolean {
  if (!row) return true;
  const last = parseDbTimestamp(row.lastAttemptAt);
  if (last === null) return true;
  const wait = row.status === "SCOPE_NOT_GRANTED" || row.status === "NOT_CONFIGURED"
    ? blockedBackoffMs
    : intervalMs;
  return now.getTime() - last >= wait;
}

/** Übersetzt einen Fehlschlag in den Tabellenzustand.
 *
 * `EbayReadError` trägt den Grund schon mit sich. Alles andere ist ein Fehler
 * auf unserer Seite und heißt `UPSTREAM_ERROR` — nie `OK`, denn ein Lauf, der
 * geworfen hat, hat nichts bewiesen.
 */
export function readSyncFailure(error: unknown): { status: EbayReadSyncStatus; detail: string } {
  if (error instanceof EbayReadError) return { status: error.code, detail: boundedDetail(error) };
  // "eBay ist noch nicht konfiguriert." wirft `getEbayConfig`, wenn die
  // Zugangsdaten fehlen. Das ist kein Ausfall, sondern ein nicht angeschlossener
  // Shop -- der Assistant soll das auch so sagen.
  const detail = boundedDetail(error);
  if (/nicht konfiguriert/iu.test(detail)) return { status: "NOT_CONFIGURED", detail };
  return { status: "UPSTREAM_ERROR", detail };
}

async function recordAttempt(
  db: Db,
  dataType: EbayReadDataType,
  status: EbayReadSyncStatus,
  now: string,
  recordCount: number,
  detail: string | null,
) {
  await db.insert(ebayReadSyncs).values({
    dataType,
    status,
    lastAttemptAt: now,
    lastSuccessAt: status === "OK" ? now : null,
    recordCount,
    detail,
  }).onConflictDoUpdate({
    target: ebayReadSyncs.dataType,
    set: {
      status,
      lastAttemptAt: now,
      // Ein Fehlschlag darf den letzten Erfolg nicht wegwischen: Genau daran
      // erkennt man, wie alt der noch stehende Datenstand ist.
      ...(status === "OK" ? { lastSuccessAt: now, recordCount } : {}),
      detail,
    },
  });
}

async function insertChunked<T>(rows: T[], columns: number, write: (chunk: T[]) => Promise<unknown>) {
  const size = maxInsertRows(columns);
  for (let index = 0; index < rows.length; index += size) {
    await write(rows.slice(index, index + size));
  }
}

// ---------------------------------------------------------------------------

async function syncTraffic(db: Db, now: Date, stamp: string): Promise<number> {
  const listings = await db.select({ ebayItemId: ebayListings.ebayItemId })
    .from(ebayListings)
    .where(eq(ebayListings.status, "ACTIVE"));
  const report: EbayTrafficReport = await fetchEbayListingTraffic(
    listings.map((listing) => listing.ebayItemId),
    now,
  );

  const { start, end } = trafficWindow(now);
  const rows = report.records.map((record) => ({
    ebayItemId: record.ebayItemId,
    rangeStart: start,
    rangeEnd: end,
    viewsTotal: record.viewsTotal,
    impressionsTotal: record.impressionsTotal,
    collectedAt: stamp,
  }));

  await insertChunked(rows, 6, (chunk) => db.insert(ebayListingTraffic).values(chunk).onConflictDoUpdate({
    target: [ebayListingTraffic.ebayItemId, ebayListingTraffic.rangeStart, ebayListingTraffic.rangeEnd],
    set: {
      viewsTotal: sql`excluded.views_total`,
      impressionsTotal: sql`excluded.impressions_total`,
      collectedAt: stamp,
    },
  }));
  // Räumt sowohl das vorige Zeitfenster ab als auch Angebote, für die eBay
  // diesmal nichts mehr meldet. Beides ist derselbe Fall: nicht mehr aktuell.
  await db.delete(ebayListingTraffic).where(ne(ebayListingTraffic.collectedAt, stamp));
  return rows.length;
}

async function syncMessages(db: Db, now: Date, stamp: string): Promise<number> {
  const messages: EbayInboxMessage[] = await fetchEbayInboxMessages(now);
  const rows = messages.map((message) => ({
    ebayMessageId: message.ebayMessageId,
    sender: message.sender,
    subject: message.subject,
    ebayItemId: message.ebayItemId,
    receivedAt: message.receivedAt,
    isRead: message.read,
    collectedAt: stamp,
  }));

  await insertChunked(rows, 7, (chunk) => db.insert(ebayInboxMessages).values(chunk).onConflictDoUpdate({
    target: ebayInboxMessages.ebayMessageId,
    set: {
      sender: sql`excluded.sender`,
      subject: sql`excluded.subject`,
      ebayItemId: sql`excluded.ebay_item_id`,
      receivedAt: sql`excluded.received_at`,
      // Der Lesestatus ändert sich, sobald der Verkäufer die Nachricht bei eBay
      // öffnet. Ohne diese Zeile bliebe sie hier für immer ungelesen.
      isRead: sql`excluded.is_read`,
      collectedAt: stamp,
    },
  }));
  await db.delete(ebayInboxMessages).where(ne(ebayInboxMessages.collectedAt, stamp));
  return rows.length;
}

async function syncBuyerOffers(db: Db, _now: Date, stamp: string): Promise<number> {
  const offers: EbayBuyerOffer[] = await fetchEbayBuyerOffers();
  const rows = offers.map((offer) => ({
    bestOfferId: offer.bestOfferId,
    ebayItemId: offer.ebayItemId,
    amountCents: offer.amountCents,
    currency: offer.currency,
    quantity: offer.quantity,
    status: offer.status,
    hasBuyerMessage: offer.hasBuyerMessage,
    expiresAt: offer.expiresAt,
    collectedAt: stamp,
  }));

  await insertChunked(rows, 9, (chunk) => db.insert(ebayBuyerOffers).values(chunk).onConflictDoUpdate({
    target: ebayBuyerOffers.bestOfferId,
    set: {
      amountCents: sql`excluded.amount_cents`,
      currency: sql`excluded.currency`,
      quantity: sql`excluded.quantity`,
      status: sql`excluded.status`,
      hasBuyerMessage: sql`excluded.has_buyer_message`,
      expiresAt: sql`excluded.expires_at`,
      collectedAt: stamp,
    },
  }));
  // Angenommene, abgelehnte und abgelaufene Vorschläge verschwinden damit von
  // selbst: eBay liefert sie unter `Active` nicht mehr mit.
  await db.delete(ebayBuyerOffers).where(ne(ebayBuyerOffers.collectedAt, stamp));
  return rows.length;
}

/** Die Verkaufshistorie — **der einzige Schritt, der nichts löscht.**
 *
 * Die drei Schritte darüber räumen ab, was eBay nicht mehr meldet, weil dort
 * „nicht mehr gemeldet" gleichbedeutend mit „nicht mehr aktuell" ist. Bei
 * Verkäufen heißt es „aus dem Abfragefenster gerutscht", und ein Verkauf hört
 * dadurch nicht auf, stattgefunden zu haben. Ein `delete … where collected_at
 * <> stamp` würde hier bei jedem Lauf die Historie auf das Fenster kürzen.
 *
 * Posten ohne Verkaufszeitpunkt fallen weg statt einen erfundenen zu bekommen:
 * Eine Übersicht „letzte x Tage" könnte sie ohnehin nirgends einordnen.
 */
async function syncSales(db: Db, now: Date, stamp: string): Promise<number> {
  const sales: EbaySaleRecord[] = await fetchEbaySales(now);
  const rows = sales
    .filter((sale) => sale.soldAt !== null)
    .map((sale) => ({
      ebayOrderId: sale.ebayOrderId,
      lineItemId: sale.lineItemId,
      ebayItemId: sale.ebayItemId,
      title: sale.title,
      quantity: sale.quantity,
      amountCents: sale.amountCents,
      orderTotalCents: sale.orderTotalCents,
      currency: sale.currency,
      soldAt: sale.soldAt as string,
      collectedAt: stamp,
    }));

  await insertChunked(rows, 10, (chunk) => db.insert(ebaySales).values(chunk).onConflictDoUpdate({
    target: [ebaySales.ebayOrderId, ebaySales.lineItemId],
    set: {
      // Titel und Beträge können sich bei einer Stornierung oder Korrektur bei
      // eBay noch ändern; der Schlüssel bleibt derselbe.
      ebayItemId: sql`excluded.ebay_item_id`,
      title: sql`excluded.title`,
      quantity: sql`excluded.quantity`,
      amountCents: sql`excluded.amount_cents`,
      orderTotalCents: sql`excluded.order_total_cents`,
      currency: sql`excluded.currency`,
      soldAt: sql`excluded.sold_at`,
      collectedAt: stamp,
    },
  }));
  return rows.length;
}

const SYNC_STEPS = [
  ["TRAFFIC", syncTraffic],
  ["MESSAGES", syncMessages],
  ["BEST_OFFERS", syncBuyerOffers],
  ["SALES", syncSales],
] as const satisfies ReadonlyArray<readonly [EbayReadDataType, (db: Db, now: Date, stamp: string) => Promise<number>]>;

const EBAY_READ_DATA_TYPES: EbayReadDataType[] = SYNC_STEPS.map(([dataType]) => dataType);

export type EbayReadSyncResult = {
  dataType: EbayReadDataType;
  status: EbayReadSyncStatus | "SKIPPED";
  recordCount: number;
};

/** Führt den Lesesync aus — je Datentyp einzeln und unabhängig.
 *
 * Unabhängig ist der Punkt: Der Traffic-Report scheitert heute erwartbar am
 * fehlenden Scope. Liefe alles in einem Block, nähme er Postfach und
 * Preisvorschläge mit, und Phase 8 hätte drei nicht verfügbare Quellen statt
 * einer.
 */
export async function runEbayReadSync(db: Db, now: Date = new Date()): Promise<EbayReadSyncResult[]> {
  const stamp = now.toISOString();
  const existing = await db.select({
    dataType: ebayReadSyncs.dataType,
    status: ebayReadSyncs.status,
    lastAttemptAt: ebayReadSyncs.lastAttemptAt,
  }).from(ebayReadSyncs);
  const byType = new Map(existing.map((row) => [row.dataType, row]));

  const results: EbayReadSyncResult[] = [];
  for (const [dataType, step] of SYNC_STEPS) {
    if (!isEbayReadSyncDue(byType.get(dataType), now)) {
      results.push({ dataType, status: "SKIPPED", recordCount: 0 });
      continue;
    }
    try {
      const recordCount = await step(db, now, stamp);
      await recordAttempt(db, dataType, "OK", stamp, recordCount, null);
      results.push({ dataType, status: "OK", recordCount });
    } catch (error) {
      const { status, detail } = readSyncFailure(error);
      console.error(`[ebay-read-sync] ${dataType} fehlgeschlagen:`, detail);
      await recordAttempt(db, dataType, status, stamp, 0, detail);
      results.push({ dataType, status, recordCount: 0 });
    }
  }
  return results;
}

/** Der Zustand aller drei Quellen, wie der Assistant ihn braucht. */
export async function readEbayReadSyncStates(db: Db): Promise<Map<EbayReadDataType, {
  status: EbayReadSyncStatus;
  lastSuccessAt: string | null;
  recordCount: number;
}>> {
  const rows = await db.select({
    dataType: ebayReadSyncs.dataType,
    status: ebayReadSyncs.status,
    lastSuccessAt: ebayReadSyncs.lastSuccessAt,
    recordCount: ebayReadSyncs.recordCount,
  }).from(ebayReadSyncs).where(inArray(ebayReadSyncs.dataType, EBAY_READ_DATA_TYPES));
  return new Map(rows.map((row) => [row.dataType, {
    status: row.status,
    lastSuccessAt: row.lastSuccessAt,
    recordCount: row.recordCount,
  }]));
}
