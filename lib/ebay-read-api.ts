/** Die drei **ausschließlich lesenden** eBay-Quellen der Phase 8.
 *
 * Aufrufzahlen, Postfach, Käufer-Preisvorschläge. In dieser Datei steht kein
 * einziger schreibender Aufruf, und es soll auch keiner hineinkommen: Alles,
 * was eBay verändert, gehört in `lib/ebay-client.ts` neben die dortigen
 * Warnhinweise.
 *
 * Die Zerlegung der Antworten (`parse*`) ist von den Abrufen (`fetch*`)
 * getrennt. Nur so lassen sich leere, lückenhafte und kaputte eBay-Antworten
 * prüfen, ohne eBay anzufassen — siehe `tests/ebay-read-api.test.mjs`.
 */

import {
  apiBase,
  fetchWithTimeout,
  getEbayAccessToken,
  getEbayConfig,
  type EbayConfig,
} from "./ebay-client.ts";
import {
  parseEbayDate,
  tradingErrorCodes,
  tradingFailed,
  xmlAttribute,
  xmlBlock,
  xmlBlocks,
  xmlValue,
} from "./ebay-xml.ts";

/** Der Scope, den der Traffic-Report verlangt.
 *
 * **Der ist heute nicht erteilt.** `app/api/admin/ebay/oauth/start/route.ts`
 * fordert bei der Zustimmung nur `sell.inventory` an, und ein Scope lässt sich
 * einem bereits ausgestellten Refresh-Token nicht nachträglich hinzufügen. Der
 * Abruf endet deshalb erwartbar mit `invalid_scope` — und genau das ist der
 * Grund, warum `EbayReadError` einen eigenen Code dafür hat, statt den Fall
 * unter „irgendein Fehler" zu verstecken.
 */
export const EBAY_ANALYTICS_READ_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly";

/** Der Basis-Scope, mit dem die Trading-Aufrufe auskommen.
 *
 * Postfach und Preisvorschläge brauchen keinen Verkaufs-Scope; der
 * IAF-Token-Weg der Trading-API genügt sich mit einem gültigen Nutzertoken.
 * Der Wert wird bewusst **nicht** in die Token-Anfrage geschrieben (siehe
 * `getEbayAccessToken`): Ohne `scope` erneuert eBay den Token mit genau den
 * Rechten der ursprünglichen Zustimmung, statt eine Anfrage abzulehnen, weil
 * ein später hinzugekommener Scope nicht dabei ist.
 */
export const EBAY_TRADING_BASE_SCOPE = "https://api.ebay.com/oauth/api_scope";

/** Warum ein Lesevorgang nichts geliefert hat.
 *
 * Der Unterschied ist der ganze Zweck: „Postfach leer" und „wir durften nicht
 * ins Postfach sehen" sehen in der Datenbank beide wie null Zeilen aus. Ohne
 * diesen Code könnte der Assistant das eine nicht vom anderen trennen und
 * müsste bei jeder leeren Tabelle raten.
 */
export type EbayReadFailureCode =
  | "NOT_CONFIGURED"
  | "SCOPE_NOT_GRANTED"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR";

export class EbayReadError extends Error {
  readonly code: EbayReadFailureCode;

  constructor(code: EbayReadFailureCode, message: string) {
    super(message);
    this.name = "EbayReadError";
    this.code = code;
  }
}

/** Obergrenze für jeden Text, der aus einer eBay-Antwort in die eigene
 *  Datenbank wandert. Ohne sie bestimmt eBay die Zeilengröße. */
const MAX_SUBJECT_LENGTH = 200;
const MAX_SENDER_LENGTH = 64;
const MAX_DETAIL_LENGTH = 300;

export function boundedText(value: string | undefined | null, max: number): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Kürzt eine Fehlerbeschreibung auf Protokollmaß und wirft Zeilenumbrüche raus. */
export function boundedDetail(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "");
  return text.replace(/\s+/gu, " ").trim().slice(0, MAX_DETAIL_LENGTH);
}

// ---------------------------------------------------------------------------
// Fehlerklassifikation
// ---------------------------------------------------------------------------

/** Die Trading-Fehlernummern, die „zu viele Aufrufe" bedeuten.
 *
 * 518 = „Your application has exceeded usage limit on this call",
 * 21919144 = „You have exceeded your maximum call limit". Beide sind aus der
 * eBay-Fehlerliste übernommen, nicht geraten. Sie stehen hier, weil ein
 * Ratenfehler etwas anderes ist als ein kaputter Aufruf: Der eine geht von
 * selbst vorbei, der andere nie.
 */
const TRADING_RATE_LIMIT_CODES = new Set(["518", "21919144"]);

/** Ordnet einen fehlgeschlagenen OAuth-Tokenaustausch ein.
 *
 * eBay antwortet bei einem nicht zugestimmten Scope mit HTTP 400 und
 * `"error":"invalid_scope"` im Rumpf — das ist das verlässliche Zeichen, und es
 * ist der Fall, in dem sich der Traffic-Report heute befindet.
 */
export function classifyTokenFailure(status: number, body: string): EbayReadFailureCode {
  if (status === 429) return "RATE_LIMITED";
  if (/invalid_scope|insufficient_scope/iu.test(body)) return "SCOPE_NOT_GRANTED";
  if (status === 401 || status === 403) return "SCOPE_NOT_GRANTED";
  return "UPSTREAM_ERROR";
}

/** Ordnet eine fehlgeschlagene REST-Antwort ein (Analytics API). */
export function classifyRestFailure(status: number, body: string): EbayReadFailureCode {
  if (status === 429) return "RATE_LIMITED";
  if (status === 401 || status === 403) return "SCOPE_NOT_GRANTED";
  if (/insufficient permissions|not authorized|invalid_scope/iu.test(body)) return "SCOPE_NOT_GRANTED";
  return "UPSTREAM_ERROR";
}

/** Ordnet eine abgelehnte Trading-Antwort anhand der Fehlernummern ein. */
export function classifyTradingFailure(xml: string): EbayReadFailureCode {
  const codes = tradingErrorCodes(xml);
  if (codes.some((code) => TRADING_RATE_LIMIT_CODES.has(code))) return "RATE_LIMITED";
  // 931/932 = Auth-Token ungültig bzw. verfallen, 21916984 = fehlende
  // Berechtigung. Alles davon ist ein Rechteproblem, kein Serverfehler.
  if (codes.some((code) => ["931", "932", "16110", "21916984"].includes(code))) return "SCOPE_NOT_GRANTED";
  return "UPSTREAM_ERROR";
}

// ---------------------------------------------------------------------------
// 1. Aufrufzahlen — Sell Analytics API, getTrafficReport
// ---------------------------------------------------------------------------

export type EbayListingTrafficRecord = {
  ebayItemId: string;
  viewsTotal: number | null;
  impressionsTotal: number | null;
};

export type EbayTrafficReport = {
  records: EbayListingTrafficRecord[];
  /** Wann eBay den Report zuletzt fortgeschrieben hat — **nicht** wann wir ihn
   *  abgerufen haben. Aufrufzahlen hinken nach; alles andere zu behaupten wäre
   *  ein erfundener Datenstand. */
  lastUpdatedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Ein Zahlenwert aus dem Report — oder `null`.
 *
 * eBay markiert nicht anwendbare Kennzahlen mit `applicable: false` und liefert
 * dazu trotzdem einen Wert. Den als 0 zu übernehmen hieße, „null Aufrufe" zu
 * behaupten, wo eBay „dazu sage ich nichts" meint.
 */
function metricNumber(value: unknown): number | null {
  const entry = asRecord(value);
  if (!entry) return null;
  if (entry.applicable === false) return null;
  // `Number(null)` und `Number("")` sind 0, nicht NaN. Ohne diese Zeile würde
  // aus einem fehlenden Wert die Aussage „null Aufrufe" — genau die erfundene
  // Zahl, die `applicable: false` oben verhindern soll.
  if (entry.value === null || entry.value === undefined || entry.value === "") return null;
  const raw = typeof entry.value === "number" ? entry.value : Number(entry.value);
  return Number.isFinite(raw) ? raw : null;
}

/** Zerlegt die Antwort von `getTrafficReport`.
 *
 * **Die Reihenfolge wird aus dem Kopf gelesen, nicht angenommen.** eBay liefert
 * `metricValues` als Liste in der Reihenfolge von `header.metrics`. Wer die
 * Position fest verdrahtet, vertauscht Aufrufe und Einblendungen, sobald eBay
 * die Reihenfolge ändert oder eine Kennzahl hinzukommt — und zwar lautlos, weil
 * beides Zahlen sind.
 */
export function parseTrafficReport(payload: unknown): EbayTrafficReport {
  const root = asRecord(payload);
  if (!root) throw new EbayReadError("UPSTREAM_ERROR", "Der eBay-Traffic-Report ist kein Objekt.");

  const header = asRecord(root.header);
  const metricKeys = Array.isArray(header?.metrics)
    ? header.metrics.map((metric) => {
        const entry = asRecord(metric);
        const key = typeof entry?.key === "string" ? entry.key : typeof entry?.name === "string" ? entry.name : "";
        return key.toUpperCase();
      })
    : [];
  const viewsIndex = metricKeys.indexOf("LISTING_VIEWS_TOTAL");
  const impressionsIndex = metricKeys.indexOf("LISTING_IMPRESSION_TOTAL");

  const records: EbayListingTrafficRecord[] = [];
  const rows = Array.isArray(root.records) ? root.records : [];
  for (const row of rows) {
    const entry = asRecord(row);
    const dimensionValues = Array.isArray(entry?.dimensionValues) ? entry.dimensionValues : [];
    const first = asRecord(dimensionValues[0]);
    const ebayItemId = typeof first?.value === "string" ? first.value.trim() : "";
    if (!/^\d+$/u.test(ebayItemId)) continue;

    const metricValues = Array.isArray(entry?.metricValues) ? entry.metricValues : [];
    records.push({
      ebayItemId,
      viewsTotal: viewsIndex < 0 ? null : metricNumber(metricValues[viewsIndex]),
      impressionsTotal: impressionsIndex < 0 ? null : metricNumber(metricValues[impressionsIndex]),
    });
  }

  return {
    records,
    lastUpdatedAt: parseEbayDate(typeof root.lastUpdatedDate === "string" ? root.lastUpdatedDate : undefined),
  };
}

/** Wie viele Angebote eBay je Traffic-Abruf zulässt. */
export const EBAY_TRAFFIC_LISTING_BATCH = 200;

/** Formatiert ein Datum als `YYYYMMDD`, wie der Filter es verlangt. */
export function trafficDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/gu, "");
}

/** Das Zeitfenster des Reports.
 *
 * Endet **gestern**: Der laufende Tag ist bei eBay noch nicht ausgezählt, ein
 * Wert dafür wäre systematisch zu niedrig. 30 Tage liegen weit unter der
 * 90-Tage-Grenze und geben einer Karte genug Zeit, überhaupt gesehen zu werden.
 */
export const EBAY_TRAFFIC_WINDOW_DAYS = 30;

export function trafficWindow(now: Date = new Date()): { start: string; end: string } {
  const end = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (EBAY_TRAFFIC_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);
  return { start: trafficDateStamp(start), end: trafficDateStamp(end) };
}

async function analyticsToken(config: EbayConfig): Promise<string> {
  try {
    return await getEbayAccessToken(config, EBAY_ANALYTICS_READ_SCOPE);
  } catch (error) {
    const detail = boundedDetail(error);
    const status = Number(detail.match(/\((\d{3})\)/u)?.[1] ?? "0");
    throw new EbayReadError(classifyTokenFailure(status, detail), detail);
  }
}

/** Holt die Aufrufzahlen für die übergebenen Angebote.
 *
 * Die Angebotskennungen kommen aus der **eigenen** Tabelle, nicht aus einer
 * offenen Abfrage: Ohne `listing_ids` liefert eBay höchstens 200 Angebote in
 * einer Reihenfolge, die nirgends zugesichert ist — bei knapp 300 Karten wäre
 * also unbestimmt, welche fehlen.
 */
export async function fetchEbayListingTraffic(
  ebayItemIds: string[],
  now: Date = new Date(),
): Promise<EbayTrafficReport> {
  const ids = [...new Set(ebayItemIds.map((value) => value.replace(/[^0-9]/gu, "")).filter(Boolean))];
  if (!ids.length) return { records: [], lastUpdatedAt: null };

  const config = getEbayConfig();
  const accessToken = await analyticsToken(config);
  const { start, end } = trafficWindow(now);

  const records: EbayListingTrafficRecord[] = [];
  let lastUpdatedAt: string | null = null;

  for (let index = 0; index < ids.length; index += EBAY_TRAFFIC_LISTING_BATCH) {
    const batch = ids.slice(index, index + EBAY_TRAFFIC_LISTING_BATCH);
    const filter = [
      `marketplace_ids:{${config.marketplaceId}}`,
      `date_range:[${start}..${end}]`,
      `listing_ids:{${batch.join("|")}}`,
    ].join(",");
    const url = `${apiBase(config.environment)}/sell/analytics/v1/traffic_report`
      + `?dimension=LISTING&metric=LISTING_VIEWS_TOTAL,LISTING_IMPRESSION_TOTAL&filter=${encodeURIComponent(filter)}`;

    const response = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new EbayReadError(
        classifyRestFailure(response.status, body),
        `eBay-Traffic-Report fehlgeschlagen (${response.status}): ${boundedDetail(body)}`,
      );
    }
    const parsed = parseTrafficReport(await response.json());
    records.push(...parsed.records);
    if (parsed.lastUpdatedAt && (!lastUpdatedAt || parsed.lastUpdatedAt > lastUpdatedAt)) {
      lastUpdatedAt = parsed.lastUpdatedAt;
    }
  }

  return { records, lastUpdatedAt };
}

// ---------------------------------------------------------------------------
// 2. Postfach — Trading API, GetMyMessages
// ---------------------------------------------------------------------------

export type EbayInboxMessage = {
  ebayMessageId: string;
  sender: string | null;
  subject: string;
  ebayItemId: string | null;
  receivedAt: string | null;
  read: boolean;
};

/** Zerlegt eine `GetMyMessages`-Antwort.
 *
 * Es wird **kein** Nachrichtentext gelesen, und zwar nicht aus Nachlässigkeit:
 * Der Abruf fordert `DetailLevel ReturnHeaders` an, dann liefert eBay den Text
 * gar nicht erst. Was nicht ankommt, kann auch nicht versehentlich gespeichert
 * werden — das ist die stabilere Form von Datensparsamkeit als „wir speichern
 * es halt nicht".
 */
export function parseInboxMessages(xml: string): EbayInboxMessage[] {
  if (tradingFailed(xml)) {
    throw new EbayReadError(classifyTradingFailure(xml), `eBay GetMyMessages fehlgeschlagen: ${boundedDetail(xmlValue(xml, "LongMessage") ?? "Unbekannter eBay-Fehler.")}`);
  }
  const container = xmlBlock(xml, "Messages");
  if (!container) return [];

  const messages: EbayInboxMessage[] = [];
  for (const block of xmlBlocks(container, "Message")) {
    const ebayMessageId = boundedText(xmlValue(block, "MessageID"), 64);
    if (!ebayMessageId) continue;
    messages.push({
      ebayMessageId,
      sender: boundedText(xmlValue(block, "Sender"), MAX_SENDER_LENGTH),
      subject: boundedText(xmlValue(block, "Subject"), MAX_SUBJECT_LENGTH) ?? "Nachricht ohne Betreff",
      ebayItemId: boundedText(xmlValue(block, "ItemID"), 32),
      receivedAt: parseEbayDate(xmlValue(block, "ReceiveDate")),
      read: (xmlValue(block, "Read") ?? "").toLowerCase() === "true",
    });
  }
  // Ein Postfach kann dieselbe Nachricht über zwei Ordner ausliefern. Die
  // Nachrichtenkennung ist die stabile Identität.
  return [...new Map(messages.map((message) => [message.ebayMessageId, message])).values()];
}

/** Wie weit zurück das Postfach gelesen wird. */
export const EBAY_MESSAGE_WINDOW_DAYS = 30;

async function tradingCall(config: EbayConfig, callName: string, body: string): Promise<string> {
  let accessToken: string;
  try {
    accessToken = await getEbayAccessToken(config);
  } catch (error) {
    const detail = boundedDetail(error);
    const status = Number(detail.match(/\((\d{3})\)/u)?.[1] ?? "0");
    throw new EbayReadError(classifyTokenFailure(status, detail), detail);
  }

  const response = await fetchWithTimeout(`${apiBase(config.environment)}/ws/api.dll`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-SITEID": config.siteId,
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1231",
      "X-EBAY-API-IAF-TOKEN": accessToken,
    },
    body,
  });
  if (!response.ok) {
    throw new EbayReadError(
      response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
      `eBay ${callName} fehlgeschlagen (${response.status}).`,
    );
  }
  return response.text();
}

export async function fetchEbayInboxMessages(now: Date = new Date()): Promise<EbayInboxMessage[]> {
  const config = getEbayConfig();
  const start = new Date(now.getTime() - EBAY_MESSAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // ReturnHeaders statt ReturnMessages: Betreff, Absender, Zeitpunkt und
  // Lesestatus reichen für die Frage „gibt es Neues?" -- der Fließtext nicht
  // nur unnötig, sondern die eine Sache, die hier nicht liegen soll.
  const request = `<?xml version="1.0" encoding="utf-8"?><GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">`
    + `<DetailLevel>ReturnHeaders</DetailLevel>`
    + `<StartTime>${start}</StartTime><EndTime>${now.toISOString()}</EndTime>`
    + `</GetMyMessagesRequest>`;
  return parseInboxMessages(await tradingCall(config, "GetMyMessages", request));
}

// ---------------------------------------------------------------------------
// 3. Käufer-Preisvorschläge — Trading API, GetBestOffers
// ---------------------------------------------------------------------------

export type EbayBuyerOffer = {
  bestOfferId: string;
  ebayItemId: string;
  amountCents: number | null;
  currency: string;
  quantity: number | null;
  status: string;
  /** Nur ob eine Nachricht dabei lag, nie ihr Inhalt und nie der Käufername.
   *  Für „gibt es neue Vorschläge?" zählt Karte, Betrag und Frist — wer
   *  geboten hat, steht bei eBay und muss hier nicht zusätzlich liegen. */
  hasBuyerMessage: boolean;
  /** eBay nennt **keinen** Eingangszeitpunkt: `BestOfferType` führt
   *  `ExpirationTime`, aber kein Gegenstück dazu. Aus der 48-Stunden-Frist
   *  einen Eingang zurückzurechnen wäre geraten, nicht gemessen — deshalb gibt
   *  es das Feld hier nicht, und sortiert wird nach Ablauf: Der Vorschlag, der
   *  zuerst verfällt, braucht zuerst eine Antwort. */
  expiresAt: string | null;
};

/** Zerlegt eine `GetBestOffers`-Antwort.
 *
 * Der Aufbau ist dreifach geschachtelt — `ItemBestOffersArray` >
 * `ItemBestOffers` > (`Item`, `BestOfferArray` > `BestOffer`) — und alle
 * Ebenen fangen mit denselben Buchstaben an. Deshalb wird von außen nach innen
 * gelesen: Erst der Block je Angebot, dann darin die Angebotskennung, dann die
 * Gebote. Flach über das ganze Dokument gesucht, mischten sich die Ebenen.
 */
export function parseBestOffers(xml: string): EbayBuyerOffer[] {
  if (tradingFailed(xml)) {
    throw new EbayReadError(classifyTradingFailure(xml), `eBay GetBestOffers fehlgeschlagen: ${boundedDetail(xmlValue(xml, "LongMessage") ?? "Unbekannter eBay-Fehler.")}`);
  }

  const offers: EbayBuyerOffer[] = [];
  for (const itemBlock of xmlBlocks(xml, "ItemBestOffers")) {
    const ebayItemId = boundedText(xmlValue(itemBlock, "ItemID"), 32);
    if (!ebayItemId) continue;
    for (const offerBlock of xmlBlocks(itemBlock, "BestOffer")) {
      const bestOfferId = boundedText(xmlValue(offerBlock, "BestOfferID"), 64);
      const status = boundedText(xmlValue(offerBlock, "Status"), 32);
      if (!bestOfferId || !status) continue;
      const price = Number(xmlValue(offerBlock, "Price"));
      const quantity = Number(xmlValue(offerBlock, "Quantity"));
      offers.push({
        bestOfferId,
        ebayItemId,
        amountCents: Number.isFinite(price) ? Math.round(price * 100) : null,
        currency: xmlAttribute(offerBlock, "Price", "currencyID") ?? "EUR",
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
        status,
        hasBuyerMessage: Boolean(boundedText(xmlValue(offerBlock, "BuyerMessage"), 1)),
        expiresAt: parseEbayDate(xmlValue(offerBlock, "ExpirationTime")),
      });
    }
  }
  return [...new Map(offers.map((offer) => [offer.bestOfferId, offer])).values()];
}

export async function fetchEbayBuyerOffers(): Promise<EbayBuyerOffer[]> {
  const config = getEbayConfig();
  // `Active` = die Vorschläge, auf die der Verkäufer noch reagieren kann.
  // Abgelehnte und abgelaufene interessieren die Frage „gibt es Neues?" nicht
  // und müssten sonst nur wieder aussortiert werden.
  const request = `<?xml version="1.0" encoding="utf-8"?><GetBestOffersRequest xmlns="urn:ebay:apis:eBLBaseComponents">`
    + `<BestOfferStatus>Active</BestOfferStatus><DetailLevel>ReturnAll</DetailLevel>`
    + `</GetBestOffersRequest>`;
  return parseBestOffers(await tradingCall(config, "GetBestOffers", request));
}
