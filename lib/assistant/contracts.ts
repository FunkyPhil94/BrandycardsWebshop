export const ASSISTANT_TOOL_NAMES = [
  "latest_sale",
  "latest_listing",
  "new_orders",
  "open_shop_offers",
  "inventory_review",
  "ebay_most_viewed",
  "ebay_messages",
  "ebay_buyer_offers",
  "new_shop_inquiries",
  "ebay_sync_health",
  "assistant_statistics",
] as const;

export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];
export type AssistantDataSource = "SHOP_DB" | "EBAY_CACHE" | "EBAY_READ_API" | "EBAY_WEBHOOK" | "SYSTEM";

/** Was über die Verfügbarkeit eines Werkzeugs **vorab** gesagt werden kann.
 *
 * `READY` heißt: liest die eigene Datenbank, kann immer antworten.
 * `SOURCE_DEPENDENT` heißt: angeschlossen, aber die Antwort hängt an einer
 * fremden Schnittstelle und kann zur Laufzeit `UNAVAILABLE` sein.
 *
 * Bis Phase 7 stand hier für die eBay-Werkzeuge der Unverfügbarkeitsgrund
 * selbst (`DATA_NOT_CAPTURED`). Das war richtig, solange es die Quelle nicht
 * gab — jetzt gibt es sie, und ob sie liefert, entscheidet sich erst beim
 * Abruf. Ein festes `READY` wäre an dieser Stelle die Lüge, die Phase 8
 * gerade vermeiden soll.
 */
export type AssistantToolAvailability = "READY" | "SOURCE_DEPENDENT";

export const ASSISTANT_TOOL_DEFINITIONS = [
  { name: "latest_sale", description: "Zuletzt verkaufte Karte oder Bestellung", availability: "READY" },
  { name: "latest_listing", description: "Zuletzt im Shop oder bei eBay eingestellte Karte", availability: "READY" },
  { name: "new_orders", description: "Bezahlte oder in Bearbeitung befindliche Shop-Bestellungen", availability: "READY" },
  { name: "open_shop_offers", description: "Offene Preisvorschläge aus dem BrandyCards-Shop", availability: "READY" },
  { name: "inventory_review", description: "Karten mit Nachfüll- oder Prüfbedarf", availability: "READY" },
  { name: "ebay_most_viewed", description: "Eigene eBay-Angebote nach Aufrufen, absteigend", availability: "SOURCE_DEPENDENT" },
  { name: "ebay_messages", description: "Neue Nachrichten aus dem eBay-Postfach", availability: "SOURCE_DEPENDENT" },
  { name: "ebay_buyer_offers", description: "Offene Käufer-Preisvorschläge auf eigene eBay-Angebote", availability: "SOURCE_DEPENDENT" },
  { name: "new_shop_inquiries", description: "Neue Anfragen aus dem BrandyCards-Shop", availability: "READY" },
  { name: "ebay_sync_health", description: "Stand des eBay-Abgleichs und offener Rücknahmeaufträge", availability: "READY" },
  { name: "assistant_statistics", description: "Kompakte Shop- und Betriebsstatistik", availability: "READY" },
] as const satisfies readonly {
  name: AssistantToolName;
  description: string;
  availability: AssistantToolAvailability;
}[];

export type AssistantToolInput<K extends AssistantToolName = AssistantToolName> = {
  tool: K;
  limit: number;
};

export type AssistantSaleItem = {
  productId: string | null;
  title: string;
  quantity: number | null;
  amountCents: number | null;
  currency: string;
};

export type AssistantToolDataMap = {
  latest_sale: {
    sale: null | {
      source: "SHOP" | "EBAY";
      reference: string;
      status: string;
      soldAt: string | null;
      detailsComplete: boolean;
      items: AssistantSaleItem[];
    };
  };
  latest_listing: {
    listing: null | {
      source: "SHOP" | "EBAY";
      productId: string;
      title: string;
      listedAt: string | null;
      priceAmountCents: number | null;
      priceCurrency: string;
      listingUrl: string | null;
    };
  };
  new_orders: {
    definition: string;
    orders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      createdAt: string | null;
      paidAt: string | null;
      totalAmountCents: number;
      currency: string;
      items: AssistantSaleItem[];
    }>;
  };
  open_shop_offers: {
    offers: Array<{
      id: string;
      productId: string;
      title: string;
      proposedAmountCents: number;
      listPriceAmountCents: number | null;
      currency: string;
      status: string;
      createdAt: string | null;
      expiresAt: string | null;
    }>;
  };
  inventory_review: {
    definition: string;
    items: Array<{
      productId: string;
      title: string;
      attention: "REFILL" | "CHECK";
      reasonCode: string;
      availableQuantity: number | null;
      listingQuantity: number | null;
      lastSyncedAt: string | null;
    }>;
  };
  ebay_most_viewed: {
    /** Das ausgewertete Zeitfenster als `YYYYMMDD`. eBay liefert keine
     *  Momentaufnahme, sondern eine Summe — ohne das Fenster wäre die Zahl
     *  nicht einzuordnen. */
    rangeStart: string | null;
    rangeEnd: string | null;
    listings: Array<{
      ebayItemId: string;
      title: string | null;
      listingUrl: string | null;
      viewsTotal: number | null;
      impressionsTotal: number | null;
    }>;
  };
  ebay_messages: {
    unreadCount: number;
    messages: Array<{
      ebayMessageId: string;
      sender: string | null;
      subject: string;
      ebayItemId: string | null;
      receivedAt: string | null;
      read: boolean;
    }>;
  };
  ebay_buyer_offers: {
    offers: Array<{
      bestOfferId: string;
      ebayItemId: string;
      title: string | null;
      amountCents: number | null;
      listPriceAmountCents: number | null;
      currency: string;
      quantity: number | null;
      status: string;
      hasBuyerMessage: boolean;
      expiresAt: string | null;
    }>;
  };
  new_shop_inquiries: {
    inquiries: Array<{
      id: string;
      title: string;
      productTitle: string | null;
      status: string;
      createdAt: string | null;
    }>;
  };
  ebay_sync_health: {
    latestRun: null | {
      id: string;
      status: string;
      startedAt: string | null;
      finishedAt: string | null;
      importedCount: number;
      updatedCount: number;
      deactivatedCount: number;
      failedCount: number;
    };
    dataFreshness: string | null;
    unresolvedOutboxCount: number;
    unresolvedOutbox: Array<{
      id: string;
      status: string;
      operation: string;
      ebayItemId: string | null;
      attemptCount: number;
      availableAt: string | null;
    }>;
  };
  assistant_statistics: {
    generatedAt: string;
    sellableCards: number;
    openShopOffers: number;
    actionableOrders: number;
    newShopInquiries: number;
    unresolvedEbayJobs: number;
    latestEbaySyncStatus: string | null;
    latestEbaySyncAt: string | null;
  };
};

/** Warum ein Werkzeug nichts liefern konnte.
 *
 * Die Liste ist absichtlich fein: „Es gibt nichts" ist eine Antwort, „ich darf
 * nicht nachsehen" ist eine andere, und „ich habe noch nie nachgesehen" eine
 * dritte. Alle drei sähen in der Datenbank gleich aus — als null Zeilen.
 *
 * - `DATA_NOT_CAPTURED` — eBay bietet diesen Datentyp gar nicht an.
 * - `SOURCE_NOT_CONNECTED` — die Zugangsdaten für eBay fehlen im Server.
 * - `SCOPE_NOT_GRANTED` — eBay verweigert das Recht; braucht neue Zustimmung.
 * - `NOT_SYNCED` — angeschlossen, aber noch kein erfolgreicher Abruf.
 * - `RATE_LIMITED` — eBays Tageskontingent war beim letzten Abruf erschöpft.
 * - `UPSTREAM_ERROR` — eBay hat beim letzten Abruf anders versagt.
 */
export const ASSISTANT_UNAVAILABLE_CODES = [
  "DATA_NOT_CAPTURED",
  "SOURCE_NOT_CONNECTED",
  "SCOPE_NOT_GRANTED",
  "NOT_SYNCED",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
] as const;

export type AssistantUnavailableCode = (typeof ASSISTANT_UNAVAILABLE_CODES)[number];

export type AssistantToolResult<K extends AssistantToolName = AssistantToolName> =
  | {
      tool: K;
      status: "AVAILABLE";
      readOnly: true;
      sources: AssistantDataSource[];
      freshness: string | null;
      data: AssistantToolDataMap[K];
    }
  | {
      tool: K;
      status: "UNAVAILABLE";
      readOnly: true;
      sources: AssistantDataSource[];
      code: AssistantUnavailableCode;
      message: string;
      data: null;
    };

export type AnyAssistantToolResult = {
  [K in AssistantToolName]: AssistantToolResult<K>;
}[AssistantToolName];

export const MAX_ASSISTANT_QUESTION_LENGTH = 1_000;

export type AssistantQuestionInput = {
  message: string;
};

export type AssistantOrchestratorToolSummary = {
  tool: AssistantToolName;
  status: "AVAILABLE" | "UNAVAILABLE" | "ERROR";
  sources: AssistantDataSource[];
  freshness: string | null;
};

export type AssistantOrchestratorResponse = {
  status: "ANSWERED" | "PARTIAL" | "FAILED" | "UNSUPPORTED";
  readOnly: true;
  answer: string;
  tools: AssistantOrchestratorToolSummary[];
  sources: AssistantDataSource[];
  freshness: string | null;
};

export class AssistantRequestError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "AssistantRequestError";
  }
}

export function availableAssistantResult<K extends AssistantToolName>(
  tool: K,
  data: AssistantToolDataMap[K],
  sources: AssistantDataSource[],
  freshness: string | null = null,
): AssistantToolResult<K> {
  return { tool, status: "AVAILABLE", readOnly: true, sources, freshness, data };
}

export function unavailableAssistantResult<K extends AssistantToolName>(
  tool: K,
  code: AssistantUnavailableCode,
  message: string,
  sources: AssistantDataSource[] = [],
): AssistantToolResult<K> {
  return { tool, status: "UNAVAILABLE", readOnly: true, sources, code, message, data: null };
}

export function parseAssistantToolInput(value: unknown): AssistantToolInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AssistantRequestError("Die Assistant-Anfrage muss ein JSON-Objekt sein.");
  }

  const input = value as Record<string, unknown>;
  const allowedFields = new Set(["tool", "limit"]);
  const unexpected = Object.keys(input).filter((field) => !allowedFields.has(field));
  if (unexpected.length) {
    throw new AssistantRequestError(`Nicht unterstützte Felder: ${unexpected.join(", ")}.`);
  }

  if (typeof input.tool !== "string" || !(ASSISTANT_TOOL_NAMES as readonly string[]).includes(input.tool)) {
    throw new AssistantRequestError("Unbekanntes Assistant-Werkzeug.");
  }

  const limit = input.limit === undefined ? 10 : input.limit;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    throw new AssistantRequestError("limit muss eine ganze Zahl zwischen 1 und 20 sein.");
  }

  return { tool: input.tool as AssistantToolName, limit };
}

export function parseAssistantQuestionInput(value: unknown): AssistantQuestionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AssistantRequestError("Die Assistant-Anfrage muss ein JSON-Objekt sein.");
  }

  const input = value as Record<string, unknown>;
  const unexpected = Object.keys(input).filter((field) => field !== "message");
  if (unexpected.length) {
    throw new AssistantRequestError(`Nicht unterstützte Felder: ${unexpected.join(", ")}.`);
  }

  if (typeof input.message !== "string") {
    throw new AssistantRequestError("message muss Text enthalten.");
  }

  const message = input.message.trim();
  if (!message) {
    throw new AssistantRequestError("Die Frage darf nicht leer sein.");
  }
  if (message.length > MAX_ASSISTANT_QUESTION_LENGTH) {
    throw new AssistantRequestError(`Die Frage darf höchstens ${MAX_ASSISTANT_QUESTION_LENGTH} Zeichen lang sein.`);
  }

  return { message };
}
