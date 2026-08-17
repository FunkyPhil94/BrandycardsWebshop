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
  "sales_overview",
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
  // `SOURCE_DEPENDENT`, obwohl das Werkzeug nur die eigene Datenbank liest: Die
  // Shop-Hälfte kann es immer beantworten, die eBay-Hälfte nur so gut, wie der
  // Lesesync sie geholt hat. Ein `READY` verspräche eine Vollständigkeit, für
  // die dieses Werkzeug nicht geradestehen kann.
  { name: "sales_overview", description: "Verkäufe und Umsatz der letzten Tage, Shop und eBay", availability: "SOURCE_DEPENDENT" },
] as const satisfies readonly {
  name: AssistantToolName;
  description: string;
  availability: AssistantToolAvailability;
}[];

/** Die Sätze, auf die die lokale Spracherkennung ihren Suchraum verengt.
 *
 * **Warum das hier steht und nicht im Desktop.** Diese Liste ist die Grammatik
 * der Spracheingabe. Läge sie in C#, gäbe es die Fragemuster zweimal — einmal
 * hier in den Planerregeln, einmal dort — und sie liefen auseinander, sobald
 * jemand nur eine Seite anfasst. Genau diese Doppelpflege hat Phase 4 beseitigt.
 *
 * **Was sie zusammenhält, ist ein Test, keine Disziplin.**
 * `tests/assistant-speech-grammar.test.mjs` schickt jede Phrase durch den
 * `RuleBasedAssistantPlanner` und verlangt mindestens ein Werkzeug. Eine Phrase,
 * die der Planer nicht versteht, wäre eine Frage, die der Nutzer perfekt
 * ausspricht und trotzdem nicht beantwortet bekommt — der ärgerlichste
 * denkbare Fehler. Der Test macht ihn unmöglich.
 *
 * **Es sind bewusst ganze Sätze, keine Stichwörter.** Ein Erkenner mit
 * Wortlisten muss die Wortgrenzen selbst finden; einer mit Sätzen kennt sie.
 * Für alles, was hier nicht steht, bleibt das freie Diktat daneben geladen.
 */
export const ASSISTANT_SPEECH_PHRASES = [
  "Welche Karte wurde zuletzt verkauft?",
  "Welche Karte wurde zuletzt eingestellt?",
  "Welche Bestellungen sind neu?",
  "Welche Bestellungen muss ich bearbeiten?",
  "Welche offenen Preisvorschläge gibt es?",
  "Gibt es offene Preisvorschläge bei eBay?",
  "Welcher Bestand ist knapp?",
  "Welche Lagerbestände sind kritisch?",
  "Wie viele Verkäufe hatte ich in den letzten 30 Tagen?",
  "Wie viel Umsatz hatte ich in den letzten 7 Tagen?",
  "Zeig mir die Statistik.",
  "Wie läuft der Shop?",
  "Wie ist der Stand des eBay-Abgleichs?",
  "Welche eBay-Angebote wurden am häufigsten angesehen?",
  "Gibt es neue Nachrichten bei eBay?",
  "Gibt es neue Anfragen im Shop?",
] as const;

export type AssistantToolInput<K extends AssistantToolName = AssistantToolName> = {
  tool: K;
  limit: number;
  /** Zeitraum in Tagen — nur `sales_overview` liest ihn. Bleibt er weg, gilt
   *  `SALES_OVERVIEW_DEFAULT_DAYS`. */
  days?: number;
};

/** Vorgabe und Obergrenze für den Zeitraum der Verkaufsübersicht.
 *
 * 90 Tage ist keine gewählte Zahl, sondern die Grenze, bis zu der eBay
 * Bestellungen je Abfrage zurückgibt. Wer mehr verlangt, bekäme eine Übersicht,
 * die im hinteren Teil unvollständig wäre, ohne es zu sagen.
 */
export const SALES_OVERVIEW_DEFAULT_DAYS = 30;
export const SALES_OVERVIEW_MAX_DAYS = 90;

export function boundedOverviewDays(value: unknown): number {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return SALES_OVERVIEW_DEFAULT_DAYS;
  return Math.min(SALES_OVERVIEW_MAX_DAYS, Math.max(1, Math.floor(raw)));
}

/** Ein Verkaufskanal in der Übersicht.
 *
 * `available: false` ist kein Fehler, sondern eine Aussage: Der Kanal konnte
 * nicht gelesen werden, und der Grund steht dabei. Ohne dieses Feld wäre „eBay:
 * 0 Verkäufe" nicht von „eBay: nicht nachgesehen" zu unterscheiden — derselbe
 * Unterschied, für den Phase 8 `ebay_read_syncs` eingeführt hat.
 */
export type AssistantSalesChannel = {
  available: boolean;
  orderCount: number;
  itemCount: number;
  revenueCents: number | null;
  currency: string;
  unavailableCode: AssistantUnavailableCode | null;
  unavailableMessage: string | null;
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
  sales_overview: {
    days: number;
    /** Ab wann gezählt wurde — damit die Zahl nachprüfbar ist. */
    since: string;
    /** **Woran sich der Umsatz bemisst.** Ein Betrag ohne Bezugsgröße ist keine
     *  Auskunft: Brutto vor Gebühren liest sich anders als das, was am Ende
     *  ankommt. Der Satz geht mit in die Antwort. */
    revenueBasis: string;
    currency: string;
    channels: {
      shop: AssistantSalesChannel;
      ebay: AssistantSalesChannel;
    };
    /** `null`, sobald eine der beiden Hälften fehlt — eine Gesamtsumme aus
     *  einer halben Grundlage wäre schlimmer als keine. */
    totalRevenueCents: number | null;
    totalItemCount: number | null;
    sales: Array<{
      channel: "SHOP" | "EBAY";
      reference: string;
      title: string | null;
      quantity: number;
      amountCents: number | null;
      currency: string;
      soldAt: string | null;
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

/** Für welche Oberfläche gezeichnet wird.
 *
 * **Darstellungskontext, keine Formatierung.** Ein Bild kann nicht auf
 * `prefers-color-scheme` reagieren, also muss der Server wissen, gegen welche
 * Fläche er zeichnet. Die Trennung aus Phase 4 bleibt gewahrt: Der Client sagt,
 * wie es bei ihm aussieht — was daraus wird, entscheidet der Server.
 */
export const ASSISTANT_THEMEN = ["hell", "dunkel"] as const;
export type AssistantThema = (typeof ASSISTANT_THEMEN)[number];

export type AssistantQuestionInput = {
  message: string;
  thema: AssistantThema;
};

/** Wie viele Lesarten desselben Diktats höchstens geprüft werden.
 *
 * Die Zahl ist an der Ratenbegrenzung bemessen, nicht geschätzt: Der Bereich
 * `avatar-assistant` lässt zehn Anfragen je Minute zu, und die Prüfung teilt
 * sich dieses Kontingent mit der eigentlichen Frage. Deshalb gehen **alle**
 * Kandidaten in **einer** Anfrage hinaus — eine gesprochene Frage kostet damit
 * zwei Anfragen statt sechs.
 *
 * Fünf ist die Obergrenze der Liste, nicht ihre Länge: `System.Speech` liefert
 * oft weniger. Nach unten hin verliert eine weitere Lesart ohnehin rasch an
 * Wert; was auf Platz sechs steht, hat mit dem Gesprochenen meist wenig zu tun.
 */
export const MAX_ASSISTANT_CANDIDATES = 5;

export type AssistantCandidateProbeInput = {
  candidates: string[];
};

/** Das Ergebnis der Vorauswahl.
 *
 * `selectedIndex: null` heißt „keine Lesart trifft ein Werkzeug" — und ist
 * ausdrücklich kein Fehler. Der Aufrufer bleibt dann beim ersten Kandidaten;
 * geraten wird nichts.
 */
export type AssistantCandidateProbeResponse = {
  readOnly: true;
  selectedIndex: number | null;
  selected: string | null;
};

export type AssistantOrchestratorToolSummary = {
  tool: AssistantToolName;
  status: "AVAILABLE" | "UNAVAILABLE" | "ERROR";
  sources: AssistantDataSource[];
  freshness: string | null;
};

/** Ein fertig gezeichnetes Bild zu einer Antwort.
 *
 * Der Desktop **zeigt** es an und schaltet zwischen den Schlüsseln um; er
 * zeichnet nichts und rechnet nichts. Genau deshalb liegen Titel und Hinweis
 * hier mit dabei statt im Client zusammengesetzt zu werden.
 */
export type AssistantVisual = {
  schluessel: string;
  titel: string;
  hinweis: string;
  svg: string;
};

export type AssistantOrchestratorResponse = {
  status: "ANSWERED" | "PARTIAL" | "FAILED" | "UNSUPPORTED";
  readOnly: true;
  answer: string;
  tools: AssistantOrchestratorToolSummary[];
  sources: AssistantDataSource[];
  freshness: string | null;
  /** Leer, wenn zur Frage kein Bild gehört. Der Text steht **immer** und trägt
   *  die Zahlen auch dann, wenn kein Bild dabei ist. */
  visuals: AssistantVisual[];
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
  const allowedFields = new Set(["tool", "limit", "days"]);
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

  // Der Zeitraum wird hier **abgewiesen statt zurechtgebogen**, wenn er
  // unsinnig ist -- anders als `boundedOverviewDays`, das eine schon
  // akzeptierte Zahl in die Schranken weist. Eine Anfrage mit `days: 4000` ist
  // ein Fehler des Aufrufers und soll als solcher zurückkommen, nicht
  // stillschweigend als 90 durchgehen.
  if (input.days !== undefined) {
    const days = input.days;
    if (typeof days !== "number" || !Number.isSafeInteger(days) || days < 1 || days > SALES_OVERVIEW_MAX_DAYS) {
      throw new AssistantRequestError(`days muss eine ganze Zahl zwischen 1 und ${SALES_OVERVIEW_MAX_DAYS} sein.`);
    }
    return { tool: input.tool as AssistantToolName, limit, days };
  }

  return { tool: input.tool as AssistantToolName, limit };
}

export function parseAssistantQuestionInput(value: unknown): AssistantQuestionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AssistantRequestError("Die Assistant-Anfrage muss ein JSON-Objekt sein.");
  }

  const input = value as Record<string, unknown>;
  const erlaubt = new Set(["message", "thema"]);
  const unexpected = Object.keys(input).filter((field) => !erlaubt.has(field));
  if (unexpected.length) {
    throw new AssistantRequestError(`Nicht unterstützte Felder: ${unexpected.join(", ")}.`);
  }

  if (typeof input.message !== "string") {
    throw new AssistantRequestError("message muss Text enthalten.");
  }

  // Ein unbekanntes Thema wird **abgewiesen, nicht zurechtgebogen**: Es kommt
  // aus dem Client, und ein stiller Rückfall auf „hell" ließe einen dunklen
  // Desktop dauerhaft falsch gezeichnete Bilder anzeigen, ohne dass jemand
  // erfährt, warum. Fehlt das Feld ganz, ist „hell" die Vorgabe — ältere
  // Desktop-Fassungen schicken es nicht.
  if (input.thema !== undefined && !(ASSISTANT_THEMEN as readonly string[]).includes(String(input.thema))) {
    throw new AssistantRequestError(`thema muss ${ASSISTANT_THEMEN.join(" oder ")} sein.`);
  }
  const thema = (input.thema === undefined ? "hell" : input.thema) as AssistantThema;

  const message = input.message.trim();
  if (!message) {
    throw new AssistantRequestError("Die Frage darf nicht leer sein.");
  }
  if (message.length > MAX_ASSISTANT_QUESTION_LENGTH) {
    throw new AssistantRequestError(`Die Frage darf höchstens ${MAX_ASSISTANT_QUESTION_LENGTH} Zeichen lang sein.`);
  }

  return { message, thema };
}

export function parseAssistantCandidateProbeInput(value: unknown): AssistantCandidateProbeInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AssistantRequestError("Die Assistant-Anfrage muss ein JSON-Objekt sein.");
  }

  const input = value as Record<string, unknown>;
  const unexpected = Object.keys(input).filter((field) => field !== "candidates");
  if (unexpected.length) {
    throw new AssistantRequestError(`Nicht unterstützte Felder: ${unexpected.join(", ")}.`);
  }

  if (!Array.isArray(input.candidates)) {
    throw new AssistantRequestError("candidates muss eine Liste von Lesarten sein.");
  }
  if (!input.candidates.length) {
    throw new AssistantRequestError("Die Liste der Lesarten darf nicht leer sein.");
  }
  if (input.candidates.length > MAX_ASSISTANT_CANDIDATES) {
    throw new AssistantRequestError(`Es werden höchstens ${MAX_ASSISTANT_CANDIDATES} Lesarten geprüft.`);
  }

  // Jede einzelne Lesart wird an derselben Grenze gemessen wie eine getippte
  // Frage. Ohne das trüge eine Anfrage mit fünf Kandidaten das Fünffache dessen,
  // was `parseAssistantQuestionInput` zulässt.
  const candidates = input.candidates.map((candidate) => {
    if (typeof candidate !== "string") {
      throw new AssistantRequestError("Jede Lesart muss Text enthalten.");
    }
    const trimmed = candidate.trim();
    if (!trimmed) {
      throw new AssistantRequestError("Eine Lesart darf nicht leer sein.");
    }
    if (trimmed.length > MAX_ASSISTANT_QUESTION_LENGTH) {
      throw new AssistantRequestError(`Eine Lesart darf höchstens ${MAX_ASSISTANT_QUESTION_LENGTH} Zeichen lang sein.`);
    }
    return trimmed;
  });

  return { candidates };
}
