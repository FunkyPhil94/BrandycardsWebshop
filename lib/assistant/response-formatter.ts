import type {
  AnyAssistantToolResult,
  AssistantActivityEntry,
  AssistantDataSource,
  AssistantOrchestratorToolSummary,
  AssistantToolName,
} from "./contracts.ts";

export const ASSISTANT_TOOL_LABELS: Record<AssistantToolName, string> = {
  card_search: "Kartensuche",
  ebay_least_viewed: "eBay-Angebote mit den wenigsten Aufrufen",
  activity_digest: "Was war los",
  latest_sale: "Letzter Verkauf",
  latest_listing: "Letzte Einstellung",
  new_orders: "Neue Bestellungen",
  open_shop_offers: "Offene Shop-Preisvorschläge",
  inventory_review: "Kritische Lagerbestände",
  ebay_most_viewed: "eBay-Aufrufzahlen",
  ebay_messages: "eBay-Nachrichten",
  ebay_buyer_offers: "eBay-Preisvorschläge",
  new_shop_inquiries: "Neue Shop-Anfragen",
  ebay_sync_health: "eBay-Abgleich",
  assistant_statistics: "Shop-Übersicht",
  sales_overview: "Verkaufsübersicht",
  traffic_overview: "Aufrufe",
};

const SOURCE_LABELS: Record<AssistantDataSource, string> = {
  SHOP_DB: "Shop-Datenbank",
  EBAY_CACHE: "eBay-Abgleich",
  EBAY_READ_API: "eBay-Leseschnittstelle",
  EBAY_WEBHOOK: "eBay-Ereignisse",
  SYSTEM: "Systemstatus",
};

/** Wie ein Vorgang im Ereignisüberblick heißt.
 *
 * Ausgeschrieben statt als Kürzel: Der Bericht wird gelesen, oft nebenbei, und
 * `SHOP_PREISVORSCHLAG` in einer Zeile zu entschlüsseln ist Arbeit, die niemand
 * machen will.
 */
const AKTIVITAETS_LABELS: Record<AssistantActivityEntry["art"], string> = {
  SHOP_BESTELLUNG: "Shop-Bestellung",
  EBAY_VERKAUF: "eBay-Verkauf",
  SHOP_PREISVORSCHLAG: "Preisvorschlag im Shop",
  SHOP_ANFRAGE: "Shop-Anfrage",
  KARTE_EINGESTELLT: "Karte eingestellt",
  VORSCHLAG_ANGENOMMEN: "Preisvorschlag angenommen",
  VORSCHLAG_ABGELEHNT: "Preisvorschlag abgelehnt",
};

/** „in den letzten 3 Stunden" → „In den letzten 3 Stunden". */
function grossErsterBuchstabe(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatMoney(amountCents: number | null, currency: string): string | null {
  if (amountCents === null) return null;
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2).replace(".", ",")} ${currency}`;
  }
}

/** Nennt den Zeitraum so, wie danach gefragt wurde.
 *
 * **Der Befund vom 2026-08-17:** Auf „Zeig mir den Umsatz vom 10.8 bis 12.8"
 * antwortete der Assistent mit „Verkäufe der letzten 30 Tage" — der genannte
 * Zeitraum kam in der Antwort nicht einmal vor. Endet das Fenster in der
 * Vergangenheit, wurde eine Spanne genannt, und dann stehen ihre beiden Enden
 * da statt einer Tageszahl.
 */
export function zeitraumSatz(
  since: string,
  until: string | undefined,
  days: number,
  spanneGenannt = false,
): string {
  const tagLabel = (wert: string) =>
    new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
      .format(new Date(wert));

  // Ohne genannte Spanne — oder ohne `until`, also aus einer älteren Fassung
  // des Werkzeugs — bleibt es beim rollenden Fenster.
  if (!spanneGenannt || !until) {
    return `Verkäufe der letzten ${days} Tage`;
  }
  // `until` ist der Beginn des Folgetags; genannt wird der letzte enthaltene.
  const letzter = new Date(Date.parse(until) - 1).toISOString();
  return `Verkäufe vom ${tagLabel(since)} bis ${tagLabel(letzter)}`;
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
    case "activity_digest": {
      const data = result.data;
      const fenster = data.stunden === 1 ? "in der letzten Stunde" : `in den letzten ${data.stunden} Stunden`;
      // **„Nichts passiert" wird ausgesprochen.** Ein leerer Bericht sieht sonst
      // wie ein Fehler aus — und anders als bei den Aufrufzahlen ist die Aussage
      // hier belastbar: Diese Tabellen sind vollständig und haben keinen
      // Messbeginn, hinter dem sich etwas verstecken könnte.
      if (data.leer) {
        return withSource(`${grossErsterBuchstabe(fenster)} ist nichts passiert: keine Bestellungen, keine Verkäufe, keine Preisvorschläge, keine Anfragen, keine neuen Karten.`, result);
      }

      const lines = data.eintraege.map((eintrag) => {
        const betrag = formatMoney(eintrag.betragCents, eintrag.currency);
        return `• ${formatDate(eintrag.zeitpunkt)} · ${AKTIVITAETS_LABELS[eintrag.art]}: ${eintrag.bezeichnung}${betrag ? ` (${betrag})` : ""}`;
      });
      const gekuerzt = data.gesamtAnzahl > data.eintraege.length
        ? [`(${data.gesamtAnzahl} Vorgänge insgesamt; gezeigt werden die ${data.eintraege.length} neuesten.)`]
        : [];
      return withSource([
        `${grossErsterBuchstabe(fenster)} ${data.gesamtAnzahl === 1 ? "ist ein Vorgang" : `sind ${data.gesamtAnzahl} Vorgänge`} zusammengekommen, neueste zuerst:`,
        ...lines,
        ...gekuerzt,
      ].join("\n"), result);
    }
    case "ebay_least_viewed": {
      const listings = result.data.listings;
      if (!listings.length) {
        return withSource("eBay hat für den ausgewerteten Zeitraum zu keinem Angebot Aufrufzahlen gemeldet.", result);
      }
      const lines = listings.map((listing) => {
        const title = listing.title ?? `eBay-Angebot ${listing.ebayItemId}`;
        // **Null Aufrufe wird als Null benannt**, nicht als „nicht gemeldet"
        // verkleidet: Genau diese Karten sucht die Frage. Fehlende Zahlen kommen
        // hier ohnehin nicht an, sie fallen im Werkzeug heraus.
        const views = listing.viewsTotal === null
          ? "nicht gemeldet"
          : listing.viewsTotal === 0 ? "kein einziger Aufruf" : `${listing.viewsTotal} Aufrufe`;
        const impressions = listing.impressionsTotal === null ? "" : `, ${listing.impressionsTotal} Einblendungen`;
        return `• ${title}: ${views}${impressions}`;
      });
      return withSource(
        `${formatRange(result.data.rangeStart, result.data.rangeEnd)}, die mit den wenigsten Aufrufen zuerst:\n${lines.join("\n")}`,
        result,
      );
    }
    case "card_search": {
      const data = result.data;
      // **„Nicht im Angebot" ist nicht „gibt es nicht".** Produktiv gemessen am
      // 2026-08-18: „Lewandowski" trifft zwei Karten, davon eine mit beendetem
      // Listing. Wer nur „keine gefunden" hört, obwohl er zwei im Kopf hat,
      // hält den Assistenten für kaputt — der Nebensatz ist die eigentliche
      // Auskunft.
      //
      // **Eigene Zeile, nicht angehängt.** In der ersten Fassung stand der Satz
      // hinter der letzten Kartenzeile, und im Screenshot vom 2026-08-18 las
      // sich das als „70,00 € 1 weitere(r) Titeltreffer …" — der Preis und die
      // Trefferzahl klebten zu einer Zahlenfolge zusammen.
      const historie = data.nichtAngebotenAnzahl === 0
        ? []
        : [`${data.nichtAngebotenAnzahl} weitere(r) Titeltreffer ist nicht mehr im Angebot (beendet, verkauft oder inaktiv).`];

      if (!data.angeboten.length) {
        return withSource([`Zu „${data.suche}" ist aktuell keine Karte im Angebot.`, ...historie].join("\n"), result);
      }

      const lines = data.angeboten.map((karte) => {
        const preis = formatMoney(karte.priceAmountCents, karte.priceCurrency);
        const bereich = karte.bereich === "VORVERKAUF" ? "Vorverkauf" : "Shop-Katalog";
        // Die Menge nur, wenn sie etwas hinzufügt: Bei Einzelstücken — und das
        // sind fast alle — wäre „(1×)" hinter jeder Zeile bloß Rauschen.
        const menge = karte.menge !== null && karte.menge > 1 ? `, ${karte.menge}× vorhanden` : "";
        return `• ${karte.title} — ${bereich}${preis ? `, ${preis}` : ", Preis nicht hinterlegt"}${menge}`;
      });
      const gekuerzt = data.gekuerzt ? ["(Es gibt mehr Treffer; gezeigt werden die ersten.)"] : [];
      return withSource([
        `Zu „${data.suche}" ${data.angeboten.length === 1 ? "ist eine Karte" : `sind ${data.angeboten.length} Karten`} im Angebot:`,
        ...lines,
        ...gekuerzt,
        ...historie,
      ].join("\n"), result);
    }
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
    case "sales_overview": {
      const data = result.data;
      const shop = data.channels.shop;
      const ebay = data.channels.ebay;
      const zeilen = [`${zeitraumSatz(data.since, data.until, data.days, data.spanneGenannt)}:`];
      // Eine gekürzte Antwort darf nicht aussehen wie eine vollständige.
      if (data.gekuerzt) {
        zeilen.push(`(Der genannte Zeitraum ist länger, als eBay je Abfrage zurückgibt — gezeigt werden die letzten ${data.days} Tage davon.)`);
      }

      const shopUmsatz = formatMoney(shop.revenueCents, shop.currency) ?? "Betrag nicht verfügbar";
      zeilen.push(`• Shop: ${shop.orderCount} Bestellung(en), ${shop.itemCount} Karte(n), ${shopUmsatz}`);

      if (ebay.available) {
        const ebayUmsatz = formatMoney(ebay.revenueCents, ebay.currency) ?? "Betrag nicht verfügbar";
        zeilen.push(`• eBay: ${ebay.orderCount} Bestellung(en), ${ebay.itemCount} Karte(n), ${ebayUmsatz}`);
      } else {
        // Kein „0 Verkäufe": Der Kanal wurde nicht gelesen, und das ist etwas
        // anderes als „dort war nichts". Der Grund steht dabei.
        zeilen.push(`• eBay: ${ebay.unavailableMessage ?? "Diese Zahlen liegen nicht vor."}`);
      }

      const gesamt = formatMoney(data.totalRevenueCents, data.currency);
      zeilen.push(gesamt
        ? `• Gesamt: ${data.totalItemCount ?? 0} Karte(n), ${gesamt}`
        : "• Gesamt: nicht ausgewiesen, weil eine der beiden Hälften fehlt.");
      zeilen.push(data.revenueBasis);

      if (data.sales.length) {
        zeilen.push("Einzeln:");
        for (const verkauf of data.sales) {
          const betrag = formatMoney(verkauf.amountCents, verkauf.currency) ?? "Betrag nicht gemeldet";
          const titel = verkauf.title ?? `Verkauf ${verkauf.reference}`;
          zeilen.push(`• ${formatDate(verkauf.soldAt)} · ${verkauf.channel === "EBAY" ? "eBay" : "Shop"} · ${titel}: ${betrag}`);
        }
      }
      return withSource(zeilen.join("\n"), result);
    }
    case "traffic_overview": {
      const data = result.data;
      const zeilen = [`${zeitraumSatz(data.since, data.until, data.days, data.spanneGenannt).replace("Verkäufe", "Aufrufe")}:`];

      zeilen.push(`• Shop: ${data.shop.fenster} Aufruf(e) im Zeitraum, ${data.shop.gesamt} insgesamt`);
      // **Ohne diesen Satz ist die Zahl nicht zu deuten.** Ist der Zähler
      // jünger als das erfragte Fenster, ist „30 Tage: 40" kein schwacher
      // Monat, sondern schlicht alles, was es gibt.
      if (data.shop.messungSeit) {
        const beginn = Date.parse(data.shop.messungSeit);
        if (Number.isFinite(beginn) && beginn > Date.parse(data.since)) {
          zeilen.push(`  (Der Shop-Zähler läuft erst seit ${formatDate(data.shop.messungSeit)} — für die Zeit davor gibt es keine Messung, keine Null.)`);
        }
      } else {
        zeilen.push("  (Für den Shop wurde in diesem Zeitraum noch nichts gezählt.)");
      }

      for (const seite of data.shop.seiten) {
        zeilen.push(`  – ${seite.pfad}: ${seite.aufrufe}`);
      }

      if (data.ebay.available) {
        zeilen.push(`• eBay-Angebote: ${data.ebay.rollendeAufrufe} Aufruf(e) und ${data.ebay.rollendeEinblendungen} Einblendung(en) in den letzten 30 Tagen`);
        // Die Tageshistorie ist die einzige Quelle für einen frei gewählten
        // Zeitraum bei eBay — und sie reicht nur so weit zurück, wie sie
        // gesammelt wurde.
        if (data.ebay.historieSeit) {
          zeilen.push(`  – im erfragten Zeitraum: ${data.ebay.fensterAufrufe} Aufruf(e), gezählt ab ${data.ebay.historieSeit}`);
        }
      } else {
        zeilen.push(`• eBay-Angebote: ${data.ebay.unavailableMessage ?? "Diese Zahlen liegen nicht vor."}`);
      }

      // Eine Gesamtzahl für eBay gibt es nicht und kann es nicht geben. Das
      // gehört in die Antwort — sonst wirkt die fehlende Zahl wie ein Fehler.
      zeilen.push("Für eBay gibt es kein „insgesamt“: eBay liefert nur ein rollendes 30-Tage-Fenster, und die eigene Tageszählung beginnt erst mit ihrer Einrichtung.");
      // Zwei Orte, zwei Zahlen -- eine Summe daraus benennt nichts.
      zeilen.push("Shop- und eBay-Aufrufe sind getrennt gezählt und nicht addierbar.");
      return withSource(zeilen.join("\n"), result);
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
    case "ebay_most_viewed": {
      const listings = result.data.listings;
      if (!listings.length) {
        return withSource("eBay hat für den ausgewerteten Zeitraum zu keinem Angebot Aufrufzahlen gemeldet.", result);
      }
      const lines = listings.map((listing) => {
        const title = listing.title ?? `eBay-Angebot ${listing.ebayItemId}`;
        const views = listing.viewsTotal === null ? "nicht gemeldet" : `${listing.viewsTotal} Aufrufe`;
        const impressions = listing.impressionsTotal === null ? "" : `, ${listing.impressionsTotal} Einblendungen`;
        return `• ${title}: ${views}${impressions}`;
      });
      // Der Zeitraum gehört in den Satz. „412 Aufrufe" ohne Fenster ist keine
      // Auskunft -- eBay liefert eine Summe, keinen Momentanwert.
      return withSource(
        `${formatRange(result.data.rangeStart, result.data.rangeEnd)} nach Aufrufen:\n${lines.join("\n")}`,
        result,
      );
    }
    case "ebay_messages": {
      const messages = result.data.messages;
      if (!messages.length) return withSource("Im abgerufenen Zeitraum liegen keine eBay-Nachrichten vor.", result);
      const lines = messages.map((message) => {
        const sender = message.sender ? ` von ${message.sender}` : "";
        const state = message.read ? "gelesen" : "ungelesen";
        return `• ${message.subject}${sender}, ${state}, eingegangen ${formatDate(message.receivedAt)}`;
      });
      const unread = result.data.unreadCount === 0
        ? "Keine davon ist ungelesen."
        : `Davon ungelesen: ${result.data.unreadCount}.`;
      return withSource(`${messages.length} eBay-Nachricht(en). ${unread}\n${lines.join("\n")}`, result);
    }
    case "ebay_buyer_offers": {
      const offers = result.data.offers;
      if (!offers.length) return withSource("Es liegen aktuell keine offenen Käufer-Preisvorschläge bei eBay vor.", result);
      const lines = offers.map((offer) => {
        const title = offer.title ?? `eBay-Angebot ${offer.ebayItemId}`;
        const amount = formatMoney(offer.amountCents, offer.currency) ?? "Betrag nicht gemeldet";
        const listPrice = formatMoney(offer.listPriceAmountCents, offer.currency);
        const gegen = listPrice ? ` gegen ${listPrice} Angebotspreis` : "";
        const note = offer.hasBuyerMessage ? ", mit Käufernachricht" : "";
        return `• ${title}: ${amount}${gegen}, Status ${offer.status}${note}, läuft ab ${formatDate(offer.expiresAt)}`;
      });
      return withSource(
        `${offers.length} offene(r) Käufer-Preisvorschlag/-vorschläge bei eBay, der zuerst ablaufende zuerst:\n${lines.join("\n")}`,
        result,
      );
    }
  }
}

/** Macht aus zwei `YYYYMMDD`-Werten einen lesbaren Zeitraum. */
function formatRange(start: string | null, end: string | null): string {
  const asDate = (value: string | null) => {
    if (!value || !/^\d{8}$/u.test(value)) return null;
    return `${value.slice(6, 8)}.${value.slice(4, 6)}.${value.slice(0, 4)}`;
  };
  const from = asDate(start);
  const to = asDate(end);
  if (!from || !to) return "Eigene eBay-Angebote";
  return `Eigene eBay-Angebote vom ${from} bis ${to}`;
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
