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

async function getAccessToken(config: EbayConfig, scope = process.env.EBAY_OAUTH_SCOPE || "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly") {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
  });
  if (scope && scope !== "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly") form.set("scope", scope);
  const response = await fetch(`${apiBase(config.environment)}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
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
  rawData: Record<string, unknown>;
};

function parseTradingResponse(xml: string, config: EbayConfig) {
  const ack = xmlValue(xml, "Ack")?.toUpperCase();
  if (ack === "FAILURE" || ack === "PARTIAL_FAILURE") {
    throw new Error(`eBay GetMyeBaySelling fehlgeschlagen: ${xmlValue(xml, "LongMessage") ?? "Unbekannter eBay-Fehler."}`);
  }
  const items = xmlBlocks(xml, "Item").map((itemXml): EbayActiveListing | null => {
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
      imageUrls: xmlValues(itemXml, "PictureURL"),
      listingType: isAuctionType ? "AUCTION" : "FIXED_PRICE",
      listingUrl: xmlValue(itemXml, "ViewItemURLForNaturalSearch") ?? xmlValue(itemXml, "ViewItemURL") ?? `https://www.ebay.de/itm/${ebayItemId}`,
      priceAmountCents: Number.isFinite(price) ? Math.round(price * 100) : null,
      priceCurrency: xmlAttribute(itemXml, "CurrentPrice", "currencyID") ?? "EUR",
      quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
      rawData: { source: "trading-api", marketplaceId: config.marketplaceId, itemId: ebayItemId },
    };
  }).filter((item): item is EbayActiveListing => Boolean(item));
  return {
    items,
    totalPages: Number(xmlValue(xml, "TotalNumberOfPages") ?? "1") || 1,
    totalEntries: Number(xmlValue(xml, "TotalNumberOfEntries") ?? String(items.length)) || items.length,
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
    const request = `<?xml version="1.0" encoding="utf-8"?><GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents"><ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></ActiveList><DetailLevel>ReturnAll</DetailLevel></GetMyeBaySellingRequest>`;
    const response = await fetch(`${apiBase(config.environment)}/ws/api.dll`, {
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

/** Withdraws an Inventory API offer.
 *
 * NOTE: this only works for offers created through the Sell Inventory API.
 * The read sync now imports via the Trading API (`GetMyeBaySelling`), which
 * yields an ItemID rather than an offerId, so `ebay_listings.ebay_offer_id`
 * stays NULL for those listings and no withdraw job is ever enqueued. Ending
 * a Trading API listing requires `EndItem` / `EndFixedPriceItem` instead.
 */
export async function withdrawEbayOffer(offerId: string) {
  const config = getConfig();
  const accessToken = await getAccessToken(config, process.env.EBAY_WRITE_OAUTH_SCOPE || "https://api.ebay.com/oauth/api_scope/sell.inventory");
  const response = await fetch(`${apiBase(config.environment)}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, {
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
