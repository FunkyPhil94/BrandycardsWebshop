type EbayEnvironment = "production" | "sandbox";

type EbayConfig = {
  environment: EbayEnvironment;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplaceId: string;
};

export type EbayInventoryItem = {
  sku?: string;
  product?: Record<string, unknown>;
  condition?: string;
  conditionDescription?: string;
  availability?: Record<string, unknown>;
};

export type EbayOffer = {
  offerId?: string;
  sku?: string;
  marketplaceId?: string;
  listing?: Record<string, unknown>;
  pricingSummary?: Record<string, unknown>;
  status?: string;
  listingDuration?: string;
  listingStartDate?: string;
  listingEndDate?: string;
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
  };
}

function apiBase(environment: EbayEnvironment) {
  return environment === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

async function getAccessToken(config: EbayConfig, scope = process.env.EBAY_OAUTH_SCOPE || "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly") {
  const response = await fetch(`${apiBase(config.environment)}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
      scope,
    }),
  });
  if (!response.ok) throw new Error(`eBay OAuth fehlgeschlagen (${response.status}).`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("eBay OAuth hat kein Zugriffstoken geliefert.");
  return body.access_token;
}

async function ebayJson<T>(path: string): Promise<T> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const response = await fetch(`${apiBase(config.environment)}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Language": "de-DE",
      "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
    },
  });
  if (!response.ok) throw new Error(`eBay API fehlgeschlagen (${response.status}).`);
  return await response.json() as T;
}

export async function getAllInventoryItems() {
  const items: EbayInventoryItem[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const body = await ebayJson<{ inventoryItems?: EbayInventoryItem[]; total?: number }>(`/sell/inventory/v1/inventory_item?${query}`);
    items.push(...(body.inventoryItems ?? []));
    if (items.length >= (body.total ?? items.length) || (body.inventoryItems ?? []).length < limit) break;
  }
  return items;
}

export async function getOffersForSku(sku: string) {
  const config = getConfig();
  const query = new URLSearchParams({ sku, marketplace_id: config.marketplaceId, limit: "25" });
  const body = await ebayJson<{ offers?: EbayOffer[] }>(`/sell/inventory/v1/offer?${query}`);
  return body.offers ?? [];
}

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
