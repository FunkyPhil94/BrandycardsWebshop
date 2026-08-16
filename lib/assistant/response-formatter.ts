import type {
  AnyAssistantToolResult,
  AssistantDataSource,
  AssistantOrchestratorToolSummary,
  AssistantToolName,
} from "./contracts.ts";

export const ASSISTANT_TOOL_LABELS: Record<AssistantToolName, string> = {
  latest_sale: "Letzter Verkauf",
  latest_listing: "Letzte Einstellung",
  new_orders: "Neue Bestellungen",
  open_shop_offers: "Offene Shop-Preisvorschläge",
  inventory_review: "Kritische Lagerbestände",
  ebay_most_viewed: "eBay-Aufrufzahlen",
  ebay_messages: "eBay-Nachrichten",
  new_shop_inquiries: "Neue Shop-Anfragen",
  ebay_sync_health: "eBay-Abgleich",
  assistant_statistics: "Shop-Übersicht",
};

const SOURCE_LABELS: Record<AssistantDataSource, string> = {
  SHOP_DB: "Shop-Datenbank",
  EBAY_CACHE: "eBay-Abgleich",
  EBAY_WEBHOOK: "eBay-Ereignisse",
  SYSTEM: "Systemstatus",
};

function formatMoney(amountCents: number | null, currency: string): string | null {
  if (amountCents === null) return null;
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2).replace(".", ",")} ${currency}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "nicht gemeldet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "nicht gemeldet";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(parsed);
}

function sourceLine(sources: AssistantDataSource[], freshness: string | null): string {
  const source = sources.length ? sources.map((item) => SOURCE_LABELS[item]).join(", ") : "Systemstatus";
  return `Quelle: ${source} · Stand: ${formatDate(freshness)}`;
}

function withSource(text: string, result: AnyAssistantToolResult): string {
  return `${text}\n${sourceLine(result.sources, result.status === "AVAILABLE" ? result.freshness : null)}`;
}

export function formatAssistantToolResult(result: AnyAssistantToolResult): string {
  if (result.status === "UNAVAILABLE") {
    return withSource(`${ASSISTANT_TOOL_LABELS[result.tool]}: ${result.message}`, result);
  }

  switch (result.tool) {
    case "latest_sale": {
      const sale = result.data.sale;
      if (!sale) return withSource("Es wurde kein Verkauf gefunden.", result);
      const items = sale.items.length
        ? sale.items.map((item) => `${item.quantity === null ? "" : `${item.quantity}× `}${item.title}`).join(", ")
        : "Artikeldetails sind nicht verfügbar";
      const source = sale.source === "EBAY" ? "eBay" : "Shop";
      const details = sale.detailsComplete ? "" : " Die Verkaufsdetails sind unvollständig.";
      return withSource(
        `Der letzte Verkauf kam aus dem ${source}: ${items}. Status: ${sale.status}. Verkaufszeit: ${formatDate(sale.soldAt)}.${details}`,
        result,
      );
    }
    case "latest_listing": {
      const listing = result.data.listing;
      if (!listing) return withSource("Es wurde keine eingestellte Karte gefunden.", result);
      const source = listing.source === "EBAY" ? "eBay" : "Shop";
      const price = formatMoney(listing.priceAmountCents, listing.priceCurrency);
      return withSource(
        `Zuletzt eingestellt wurde „${listing.title}“ im ${source}${price ? ` für ${price}` : ""}. Einstellzeit: ${formatDate(listing.listedAt)}.`,
        result,
      );
    }
    case "new_orders": {
      const orders = result.data.orders;
      if (!orders.length) return withSource("Es gibt aktuell keine neuen bezahlten oder zu bearbeitenden Shop-Bestellungen.", result);
      const lines = orders.map((order) => {
        const total = formatMoney(order.totalAmountCents, order.currency) ?? "Betrag nicht verfügbar";
        return `• ${order.orderNumber}: ${total}, Status ${order.status}, bezahlt ${formatDate(order.paidAt)}`;
      });
      return withSource(`${orders.length} neue oder zu bearbeitende Bestellung(en):\n${lines.join("\n")}`, result);
    }
    case "open_shop_offers": {
      const offers = result.data.offers;
      if (!offers.length) return withSource("Es gibt aktuell keine offenen Preisvorschläge im Shop.", result);
      const lines = offers.map((offer) => {
        const amount = formatMoney(offer.proposedAmountCents, offer.currency) ?? "Betrag nicht verfügbar";
        return `• ${offer.title}: ${amount}, Status ${offer.status}, eingegangen ${formatDate(offer.createdAt)}`;
      });
      return withSource(`${offers.length} offene Shop-Preisvorschlag/-vorschläge:\n${lines.join("\n")}`, result);
    }
    case "inventory_review": {
      const items = result.data.items;
      if (!items.length) return withSource("Der Bestand enthält aktuell keine Karten mit Nachfüll- oder Prüfbedarf.", result);
      const lines = items.map((item) => {
        const attention = item.attention === "REFILL" ? "nachfüllen" : "prüfen";
        const quantities = item.availableQuantity === null && item.listingQuantity === null
          ? ""
          : ` (Shop: ${item.availableQuantity ?? "nicht verfügbar"}, eBay: ${item.listingQuantity ?? "nicht verfügbar"})`;
        return `• ${item.title}: ${attention}${quantities}`;
      });
      return withSource(`${items.length} Karte(n) brauchen Aufmerksamkeit:\n${lines.join("\n")}`, result);
    }
    case "new_shop_inquiries": {
      const inquiries = result.data.inquiries;
      if (!inquiries.length) return withSource("Es gibt aktuell keine neuen Shop-Anfragen.", result);
      const lines = inquiries.map((inquiry) =>
        `• ${inquiry.title}${inquiry.productTitle ? ` zu ${inquiry.productTitle}` : ""}, eingegangen ${formatDate(inquiry.createdAt)}`);
      return withSource(`${inquiries.length} neue Shop-Anfrage(n):\n${lines.join("\n")}`, result);
    }
    case "ebay_sync_health": {
      const latest = result.data.latestRun;
      const latestText = latest
        ? `Der letzte eBay-Abgleich hat den Status ${latest.status}; beendet ${formatDate(latest.finishedAt ?? latest.startedAt)}.`
        : "Es wurde noch kein eBay-Abgleich protokolliert.";
      return withSource(`${latestText} Offene Rücknahmeaufträge: ${result.data.unresolvedOutboxCount}.`, result);
    }
    case "assistant_statistics": {
      const data = result.data;
      return withSource([
        "Aktuelle Shop-Übersicht:",
        `• Verkaufbare Karten: ${data.sellableCards}`,
        `• Offene Preisvorschläge: ${data.openShopOffers}`,
        `• Zu bearbeitende Bestellungen: ${data.actionableOrders}`,
        `• Neue Shop-Anfragen: ${data.newShopInquiries}`,
        `• Offene eBay-Aufträge: ${data.unresolvedEbayJobs}`,
      ].join("\n"), result);
    }
    case "ebay_most_viewed":
    case "ebay_messages":
      return withSource(`${ASSISTANT_TOOL_LABELS[result.tool]} sind derzeit nicht verfügbar.`, result);
  }
}

export function failedToolText(tool: AssistantToolName): string {
  return `${ASSISTANT_TOOL_LABELS[tool]}: Die Daten konnten wegen eines internen Lesefehlers nicht geladen werden.\nQuelle: Systemstatus · Stand: nicht verfügbar`;
}

export function toolSummary(result: AnyAssistantToolResult): AssistantOrchestratorToolSummary {
  return {
    tool: result.tool,
    status: result.status,
    sources: result.sources,
    freshness: result.status === "AVAILABLE" ? result.freshness : null,
  };
}
