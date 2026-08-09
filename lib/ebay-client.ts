import { maxResolutionImageUrl } from "./ebay-images.ts";

type EbayEnvironment = "production" | "sandbox";

type EbayConfig = {
  environment: EbayEnvironment;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplaceId: string;
  siteId: string;
};

function getConfig(): EbayConfig {
  const environment = process.env.EBAY_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const refreshToken = process.env.EBAY_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("eBay ist noch nicht konfiguriert.");
  }
  return {
    environment,
    clientId,
    clientSecret,
    refreshToken,
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_DE",
    siteId: process.env.EBAY_SITE_ID || "77",
  };
}

function apiBase(environment: EbayEnvironment) {
  return environment === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

/** Obergrenze für einen einzelnen eBay-Aufruf.
 *
 * Großzügiger als die 10 s bei PayPal: Ein `GetMyeBaySelling` über ~300
 * Angebote ist eine schwere Antwort, und ein Importlauf darf länger dauern als
 * ein Kunde am Bezahlknopf. Entscheidend ist nicht die Höhe, sondern dass es
 * die Grenze überhaupt gibt — ohne sie wartet ein Lauf unbegrenzt und nimmt
 * die Sperre mit ins Grab (siehe `lib/sync-lock.ts`).
 *
 * Über `EBAY_FETCH_TIMEOUT_MS` übersteuerbar, damit Tests nicht 30 s warten
 * müssen, um zu belegen, dass abgebrochen wird.
 */
export const EBAY_FETCH_TIMEOUT_MS = 30_000;

function fetchTimeoutMs() {
  const configured = Number(process.env.EBAY_FETCH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : EBAY_FETCH_TIMEOUT_MS;
}

/** Wie `fetch`, nur dass es garantiert zurückkommt. Vorbild: `lib/paypal/client.ts`.
 *
 * `timeoutMs` übersteuert die Voreinstellung für **einen** Aufruf. Gebraucht
 * wird das an genau einer Stelle: Wenn die Rücknahme unmittelbar nach der
 * Zahlung läuft, wartet ein Kunde auf die Antwort — dort sind 30 Sekunden zu
 * viel, im Importlauf dagegen richtig.
 */
function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs?: number) {
  const grenze = Number.isFinite(timeoutMs) && (timeoutMs ?? 0) > 0 ? (timeoutMs as number) : fetchTimeoutMs();
  return fetch(input, { ...init, signal: AbortSignal.timeout(grenze) });
}

export const EBAY_READ_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly";

async function getAccessToken(config: EbayConfig, scope = EBAY_READ_SCOPE, timeoutMs?: number) {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
  });
  // Leaving scope out is deliberate for the regular sync. eBay then uses the
  // scopes from the original consent instead of rejecting a refresh token when
  // a later configuration accidentally asks for a newly added scope.
  if (scope && scope !== EBAY_READ_SCOPE) form.set("scope", scope);
  const response = await fetchWithTimeout(`${apiBase(config.environment)}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  }, timeoutMs);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`eBay OAuth fehlgeschlagen (${response.status}): ${body.slice(0, 240)}`);
  }
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("eBay OAuth hat kein Zugriffstoken geliefert.");
  return body.access_token;
}

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

function xmlValues(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => decodeXml(match[1] ?? ""));
}

function xmlValue(xml: string, tag: string) { return xmlValues(xml, tag)[0]; }

function xmlAttribute(xml: string, tag: string, attribute: string) {
  const match = xml.match(new RegExp(`<${tag}\\b([^>]*)>`, "i"));
  return match?.[1]?.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
}

function xmlBlocks(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => match[0]);
}

function xmlBlock(xml: string, tag: string) { return xmlBlocks(xml, tag)[0]; }

export type EbayActiveListing = {
  ebayItemId: string;
  sku?: string;
  title: string;
  description?: string;
  imageUrls: string[];
  listingType: "FIXED_PRICE" | "AUCTION";
  listingUrl: string;
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  /** eBay listing start time (ISO). Drives the "newest cards" view. */
  startAt: string | null;
  endAt: string | null;
  rawData: Record<string, unknown>;
};

/** eBay returns ISO timestamps; guard against malformed values. */
function parseEbayDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseTradingResponse(xml: string, config: EbayConfig) {
  const ack = xmlValue(xml, "Ack")?.toUpperCase();
  if (ack === "FAILURE" || ack === "PARTIAL_FAILURE") {
    throw new Error(`eBay GetMyeBaySelling fehlgeschlagen: ${xmlValue(xml, "LongMessage") ?? "Unbekannter eBay-Fehler."}`);
  }
  // GetMyeBaySelling answers with one container per requested list. Scanning the
  // whole document would also harvest <Item> blocks from SoldList/UnsoldList/
  // ScheduledList, which is how sold-and-relisted cards ended up in the shop
  // twice: once under their old, sold ItemID and once under the new active one.
  // Everything below therefore reads from the ActiveList container only.
  const activeList = xmlBlock(xml, "ActiveList");
  if (!activeList) {
    return { items: [], totalPages: 1, totalEntries: 0 };
  }
  const items = xmlBlocks(activeList, "Item").map((itemXml): EbayActiveListing | null => {
    const ebayItemId = xmlValue(itemXml, "ItemID");
    const title = xmlValue(itemXml, "Title");
    if (!ebayItemId || !title) return null;
    const listingType = (xmlValue(itemXml, "ListingType") ?? "").toUpperCase().replace(/[^A-Z]/g, "");
    const isAuctionType = ["AUCTION", "CHINESE", "DUTCH"].includes(listingType);
    const isFixedPriceType = ["FIXEDPRICEITEM", "STOREFIXEDPRICE"].includes(listingType);
    if (!isAuctionType && !isFixedPriceType) return null;
    const price = Number(xmlValue(itemXml, "CurrentPrice") ?? xmlValue(itemXml, "ConvertedCurrentPrice"));
    const quantity = Number(xmlValue(itemXml, "QuantityAvailable") ?? xmlValue(itemXml, "Quantity"));
    return {
      ebayItemId,
      sku: xmlValue(itemXml, "SKU"),
      title,
      description: xmlValue(itemXml, "Description"),
      // GetMyeBaySelling returns PictureURL for only a fraction of the items
      // and GalleryURL for the rest, which is why 291 of 296 cards had no image
      // at all. Take both, upgrade each to full resolution, then dedupe.
      imageUrls: [...new Set([
        ...xmlValues(itemXml, "PictureURL"),
        ...xmlValues(itemXml, "GalleryURL"),
      ].filter(Boolean).map(maxResolutionImageUrl))],
      listingType: isAuctionType ? "AUCTION" : "FIXED_PRICE",
      listingUrl: xmlValue(itemXml, "ViewItemURLForNaturalSearch") ?? xmlValue(itemXml, "ViewItemURL") ?? `https://www.ebay.de/itm/${ebayItemId}`,
      priceAmountCents: Number.isFinite(price) ? Math.round(price * 100) : null,
      priceCurrency: xmlAttribute(itemXml, "CurrentPrice", "currencyID") ?? "EUR",
      quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
      startAt: parseEbayDate(xmlValue(itemXml, "StartTime")),
      endAt: parseEbayDate(xmlValue(itemXml, "EndTime")),
      rawData: { source: "trading-api", marketplaceId: config.marketplaceId, itemId: ebayItemId },
    };
  }).filter((item): item is EbayActiveListing => Boolean(item));
  // The pagination result must come from ActiveList too. Read from the whole
  // document it could belong to a different container and drive the page loop
  // against the wrong total.
  const pagination = xmlBlock(activeList, "PaginationResult") ?? activeList;
  return {
    items,
    totalPages: Number(xmlValue(pagination, "TotalNumberOfPages") ?? "1") || 1,
    totalEntries: Number(xmlValue(pagination, "TotalNumberOfEntries") ?? String(items.length)) || items.length,
  };
}

/** Returns the listings that are actually active in the seller account.
 * Unlike Inventory API, this also includes listings created in the eBay UI.
 */
export async function getActiveEbayListings() {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const listings: EbayActiveListing[] = [];
  let page = 1;
  let totalPages = 1;
  let totalEntries = 0;
  do {
    // `DetailLevel` is a request-level field: with ReturnAll and no explicit
    // opt-out eBay also returns SoldList, UnsoldList, ScheduledList and BidList.
    // Those containers must stay off - they cost response size and previously
    // leaked sold items into the shop.
    const request = `<?xml version="1.0" encoding="utf-8"?><GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents"><ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></ActiveList><SoldList><Include>false</Include></SoldList><UnsoldList><Include>false</Include></UnsoldList><ScheduledList><Include>false</Include></ScheduledList><BidList><Include>false</Include></BidList><DeletedFromSoldList><Include>false</Include></DeletedFromSoldList><DeletedFromUnsoldList><Include>false</Include></DeletedFromUnsoldList><DetailLevel>ReturnAll</DetailLevel></GetMyeBaySellingRequest>`;
    const response = await fetchWithTimeout(`${apiBase(config.environment)}/ws/api.dll`, {
      method: "POST",
      headers: { "Content-Type": "text/xml", "X-EBAY-API-CALL-NAME": "GetMyeBaySelling", "X-EBAY-API-SITEID": config.siteId, "X-EBAY-API-COMPATIBILITY-LEVEL": "1231", "X-EBAY-API-IAF-TOKEN": accessToken },
      body: request,
    });
    if (!response.ok) throw new Error(`eBay GetMyeBaySelling fehlgeschlagen (${response.status}).`);
    const parsed = parseTradingResponse(await response.text(), config);
    listings.push(...parsed.items);
    totalPages = parsed.totalPages;
    totalEntries = Math.max(totalEntries, parsed.totalEntries);
    page++;
  } while (page <= totalPages && page <= 50);
  if (totalPages > 50 || listings.length < totalEntries) {
    throw new Error(`eBay-Aktivliste unvollständig: ${listings.length} von ${totalEntries} Angeboten geladen.`);
  }
  // eBay can repeat an item at a page boundary. The item ID is the stable
  // identity; returning it once prevents duplicate products downstream.
  return [...new Map(listings.map((listing) => [listing.ebayItemId, listing])).values()];
}

/** Fetches the seller-authored HTML description of a single listing.
 *
 * GetMyeBaySelling does not carry descriptions, so they can only come from
 * GetItem — one call per item. With ~300 listings that is far too much for the
 * hourly sync, hence this is called lazily when a card's detail page is opened
 * for the first time and then cached in `ebay_listings.description_html`.
 *
 * Returns null when eBay has nothing; the caller decides on the fallback.
 */
export async function getEbayItemDescription(ebayItemId: string): Promise<string | null> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const request = `<?xml version="1.0" encoding="utf-8"?><GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><ItemID>${ebayItemId.replace(/[^0-9]/g, "")}</ItemID><DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>false</IncludeItemSpecifics></GetItemRequest>`;
  const response = await fetchWithTimeout(`${apiBase(config.environment)}/ws/api.dll`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "GetItem",
      "X-EBAY-API-SITEID": config.siteId,
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1231",
      "X-EBAY-API-IAF-TOKEN": accessToken,
    },
    body: request,
  });
  if (!response.ok) throw new Error(`eBay GetItem fehlgeschlagen (${response.status}).`);
  const xml = await response.text();
  const ack = xmlValue(xml, "Ack")?.toUpperCase();
  if (ack === "FAILURE") {
    throw new Error(`eBay GetItem fehlgeschlagen: ${xmlValue(xml, "LongMessage") ?? "Unbekannter eBay-Fehler."}`);
  }
  const description = xmlValue(xml, "Description");
  return description && description.trim() ? description : null;
}

/** What eBay says about one listing's availability right now.
 *
 * `quantityAvailable: null` means eBay did not tell us — a malformed answer, a
 * field that was not returned, an item id it does not know. That is treated as
 * "no information" and never as "sold out": see `unavailableTitles`.
 */
export type EbayAvailability = { quantityAvailable: number | null; listingStatus: string | null };

/** Reads the parts of a GetItem response that decide whether a card can still
 *  be sold. Exported so the parsing can be tested without a network. */
export function parseItemAvailability(xml: string): EbayAvailability {
  const item = xmlBlock(xml, "Item") ?? xml;
  const listingStatus = xmlValue(item, "ListingStatus") ?? null;
  // eBay returns QuantityAvailable to the seller of the item. Where it is
  // missing, Quantity minus QuantitySold says the same thing.
  const direct = Number(xmlValue(item, "QuantityAvailable"));
  if (Number.isFinite(direct)) return { quantityAvailable: direct, listingStatus };
  const quantity = Number(xmlValue(item, "Quantity"));
  const sold = Number(xmlValue(item, "QuantitySold"));
  if (Number.isFinite(quantity) && Number.isFinite(sold)) {
    return { quantityAvailable: Math.max(0, quantity - sold), listingStatus };
  }
  return { quantityAvailable: null, listingStatus };
}

/** Asks eBay how many of each listing are still available.
 *
 * One token call for the whole order rather than one per card. A card whose
 * lookup fails is simply absent from the result — the caller must read that as
 * "unknown", not as "gone". See docs/ai-todo.md, Punkt 3: an eBay outage must
 * never stop the shop from selling.
 */
export async function getEbayAvailability(ebayItemIds: string[]): Promise<Map<string, EbayAvailability>> {
  const result = new Map<string, EbayAvailability>();
  const ids = [...new Set(ebayItemIds.map((id) => id.replace(/[^0-9]/g, "")).filter(Boolean))];
  if (!ids.length) return result;

  const config = getConfig();
  const accessToken = await getAccessToken(config);
  for (const ebayItemId of ids) {
    try {
      const response = await fetchWithTimeout(`${apiBase(config.environment)}/ws/api.dll`, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          "X-EBAY-API-CALL-NAME": "GetItem",
          "X-EBAY-API-SITEID": config.siteId,
          "X-EBAY-API-COMPATIBILITY-LEVEL": "1231",
          "X-EBAY-API-IAF-TOKEN": accessToken,
        },
        body: `<?xml version="1.0" encoding="utf-8"?><GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><ItemID>${ebayItemId}</ItemID><DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>false</IncludeItemSpecifics></GetItemRequest>`,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      if (xmlValue(xml, "Ack")?.toUpperCase() === "FAILURE") {
        throw new Error(xmlValue(xml, "LongMessage") ?? "Unbekannter eBay-Fehler.");
      }
      result.set(ebayItemId, parseItemAvailability(xml));
    } catch (error) {
      // Deliberately swallowed: a missing entry means "unknown", and unknown
      // lets the sale through. Logged so a systematic failure is visible.
      console.error("[ebay-availability] GetItem fehlgeschlagen", ebayItemId, error instanceof Error ? error.message : error);
    }
  }
  return result;
}

/** The OAuth scope that write calls need.
 *
 * Reading gets by with `sell.inventory.readonly`; changing a quantity does not.
 * Whether the stored refresh token actually carries this scope is decided at
 * consent time and can only be found out by making the call — see the error
 * handling in `reviseEbayItemQuantity`.
 */
export const EBAY_WRITE_SCOPE = "https://api.ebay.com/oauth/api_scope/sell.inventory";

function writeScope() {
  return process.env.EBAY_WRITE_OAUTH_SCOPE || EBAY_WRITE_SCOPE;
}

/** Checks whether the stored refresh token can obtain a **write** token.
 *
 * Answers the one question that stood open when the write path was built: does
 * `EBAY_REFRESH_TOKEN` carry `sell.inventory`, or only the readonly scope? It
 * cannot be read off the token, and it does not follow from the consent flow
 * either — the token may have been issued by other means.
 *
 * **Touches no listing.** A token exchange changes nothing at eBay, which is
 * what makes this safe to run at any time, with the write switch still off.
 *
 * Returns the outcome instead of throwing: the caller is a diagnostic, and
 * "authentication refused" is the very answer it is after.
 */
export async function checkEbayWriteAuth(): Promise<{ ok: boolean; scope: string; detail?: string }> {
  const scope = writeScope();
  try {
    const config = getConfig();
    await getAccessToken(config, scope);
    // Deliberately not the token, not even its length — only that it came.
    return { ok: true, scope };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter eBay-Fehler.";
    return { ok: false, scope, detail: detail.slice(0, 300) };
  }
}

/** Reads the eBay error numbers out of a Trading response.
 *
 * eBay states the reason in `<ErrorCode>`, and only that number is stable —
 * `LongMessage` is prose and localized. The distinction matters because the
 * outbox must not keep retrying an error that will never pass.
 */
export function tradingErrorCodes(xml: string): string[] {
  return xmlValues(xml, "ErrorCode").map((code) => code.trim()).filter(Boolean);
}

/** eBay says the listing is already over — nothing left to do.
 *
 * 21916750 = auction/listing already ended, 291 = "Auction ended". Treated as
 * success: the goal is that the card is no longer for sale, and it is not.
 * Retrying would fail forever and park the job at FAILED for no reason.
 */
const ALREADY_ENDED_CODES = new Set(["291", "21916750", "1047"]);

/** Sets the available quantity of a fixed-price listing, addressed by ItemID.
 *
 * This is the write path for listings that came in through `GetMyeBaySelling`:
 * they carry an ItemID but no Inventory API offerId, so `withdrawEbayOffer`
 * below can never reach them.
 *
 * Quantity 0 rather than `EndItem` on purpose — it is reversible. If an order
 * falls through or a reservation expires, the quantity can be set back. EndItem
 * is final; relisting mints a new ItemID and breaks the local mapping.
 *
 * NOT for auctions. A running auction has bids, and its quantity is not a thing
 * that can be revised; the caller filters those out (`lib/ebay-outbox.ts`).
 */
export async function reviseEbayItemQuantity(ebayItemId: string, quantity: number, timeoutMs?: number) {
  const itemId = ebayItemId.replace(/[^0-9]/g, "");
  if (!itemId) throw new Error("eBay-ItemID fehlt oder ist unbrauchbar.");
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Menge muss eine nicht-negative ganze Zahl sein.");

  const config = getConfig();
  const accessToken = await getAccessToken(config, writeScope(), timeoutMs);
  const request = `<?xml version="1.0" encoding="utf-8"?><ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents"><InventoryStatus><ItemID>${itemId}</ItemID><Quantity>${quantity}</Quantity></InventoryStatus></ReviseInventoryStatusRequest>`;
  const response = await fetchWithTimeout(`${apiBase(config.environment)}/ws/api.dll`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "ReviseInventoryStatus",
      "X-EBAY-API-SITEID": config.siteId,
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1231",
      "X-EBAY-API-IAF-TOKEN": accessToken,
    },
    body: request,
  }, timeoutMs);
  if (!response.ok) throw new Error(`eBay ReviseInventoryStatus fehlgeschlagen (${response.status}).`);
  const xml = await response.text();
  const ack = xmlValue(xml, "Ack")?.toUpperCase();
  if (ack === "FAILURE" || ack === "PARTIAL_FAILURE") {
    // An already-ended listing is the outcome we wanted, not a failure.
    if (tradingErrorCodes(xml).some((code) => ALREADY_ENDED_CODES.has(code))) return "ALREADY_ENDED" as const;
    throw new Error(`eBay ReviseInventoryStatus fehlgeschlagen: ${xmlValue(xml, "LongMessage") ?? "Unbekannter eBay-Fehler."}`);
  }
  return "REVISED" as const;
}

/** Withdraws an Inventory API offer.
 *
 * NOTE: this only works for offers created through the Sell Inventory API.
 * The read sync imports via the Trading API (`GetMyeBaySelling`), which yields
 * an ItemID rather than an offerId, so `ebay_listings.ebay_offer_id` stays NULL
 * for those listings. `reviseEbayItemQuantity` above is the path that actually
 * runs; this one remains for offers that do carry an offerId.
 */
export async function withdrawEbayOffer(offerId: string) {
  const config = getConfig();
  const accessToken = await getAccessToken(config, writeScope());
  const response = await fetchWithTimeout(`${apiBase(config.environment)}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Content-Language": "de-DE",
      "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
    },
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.text();
    throw new Error(`eBay-Angebot konnte nicht beendet werden (${response.status}): ${body.slice(0, 240)}`);
  }
}
