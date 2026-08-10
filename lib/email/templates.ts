import type { Locale } from "../i18n";

/** Die Nachrichten selbst.
 *
 * Reine Funktionen ohne Netz und ohne Datenbank: Sie bekommen fertige Werte und
 * geben Betreff, Nur-Text und HTML zurück. Dadurch lässt sich der Wortlaut
 * prüfen, ohne etwas zu verschicken (`tests/email.test.mjs`).
 *
 * **Ton:** geduzt wie der übrige Shop, persönlich, knapp. BrandyCards ist ein
 * Familienprojekt zweier Brüder, das darf man hören. Kein „Sehr geehrte Damen
 * und Herren", kein Behördendeutsch.
 *
 * **Keine Abmeldung im Fuß:** Alle Nachrichten hier sind transaktional, sie
 * beantworten eine Handlung des Kunden. Ein Abmeldelink wäre irreführend, weil
 * es nichts zu abonnieren gibt. Bei Werbung wäre er Pflicht.
 */

export type Nachricht = { subject: string; text: string; html: string };

export type Betrag = { cents: number; currency: string };

export type BetriebsalarmDaten = {
  key: string;
  category: string;
  title: string;
  detail: string;
  occurredAt: string;
  shopUrl: string;
};

/** Fremdeingabe für HTML unschädlich machen.
 *
 * Kartentitel stammen von eBay, Namen und Nachrichten vom Kunden. Ohne
 * Maskierung zerlegt ein Anführungszeichen die Nachricht und ein `<` kann
 * Markup einschleusen. Dieselbe Sorgfalt wie bei der Produktbeschreibung,
 * nur ohne erlaubte Auszeichnungen — in diesen Vorlagen ist **kein** fremdes
 * Markup vorgesehen.
 */
export function escapeHtml(wert: string): string {
  return wert
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

/** Zeilenumbrüche aus der Betreffzeile entfernen.
 *
 * Ein Kartentitel mit `\n` könnte sonst eine zweite Kopfzeile vortäuschen.
 * Resend nimmt den Betreff zwar als JSON-Feld entgegen und setzt die Kopfzeilen
 * selbst, aber sich darauf zu verlassen wäre eine Wette auf fremdes Verhalten.
 * Zusätzlich gekürzt, damit kein Postfach die Zeile abschneidet.
 */
export function sanitizeSubject(wert: string, maxLaenge = 160): string {
  const eine_zeile = wert.replace(/[\r\n\t]+/gu, " ").replace(/\s{2,}/gu, " ").trim();
  return eine_zeile.length > maxLaenge ? `${eine_zeile.slice(0, maxLaenge - 1).trimEnd()}…` : eine_zeile;
}

export function formatMoney({ cents, currency }: Betrag, locale: Locale = "de"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "de-DE", { style: "currency", currency }).format(cents / 100);
}

function formatDatum(iso: string, locale: Locale = "de"): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" }).format(datum);
}

/** Gemeinsamer Rahmen. Bewusst schlicht: Postfächer werfen Stilangaben im Kopf
 *  weg, deshalb stehen die wenigen Angaben direkt am Element. */
function rahmen(inhalt: string, shopUrl: string, locale: Locale = "de"): string {
  const legalNotice = locale === "en" ? "Legal notice" : "Impressum";
  const privacy = locale === "en" ? "Privacy" : "Datenschutz";
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111112;max-width:560px">`,
    inhalt,
    `<hr style="border:0;border-top:1px solid #e4e0d8;margin:28px 0 14px">`,
    `<p style="font-size:12px;color:#7c7770;margin:0">`,
    `BrandyCards · Leverkusen · `,
    `<a href="${escapeHtml(shopUrl)}/impressum" style="color:#7c7770">${legalNotice}</a> · `,
    `<a href="${escapeHtml(shopUrl)}/datenschutz" style="color:#7c7770">${privacy}</a>`,
    `</p>`,
    `</div>`,
  ].join("");
}

function fussText(shopUrl: string, locale: Locale = "de"): string {
  return locale === "en"
    ? `\n\n--\nBrandyCards · Leverkusen\nLegal notice: ${shopUrl}/impressum\nPrivacy: ${shopUrl}/datenschutz\n`
    : `\n\n--\nBrandyCards · Leverkusen\nImpressum: ${shopUrl}/impressum\nDatenschutz: ${shopUrl}/datenschutz\n`;
}

/** Interne Nachricht an den Betreiber. Sie enthält nur die kurze Diagnose und
 * eine fachliche Kennung, keine Kundenadresse oder vollständige Fremdpayload. */
export function operationalAlert(daten: BetriebsalarmDaten): Nachricht {
  const text = [
    `BrandyCards Betriebsalarm`,
    ``,
    `Bereich: ${daten.category}`,
    `Problem: ${daten.title}`,
    `Details: ${daten.detail}`,
    `Kennung: ${daten.key}`,
    `Zeit: ${daten.occurredAt}`,
    ``,
    `Bitte im Adminbereich und beim jeweiligen Anbieter prüfen.`,
    fussText(daten.shopUrl),
  ].join("\n");

  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">BrandyCards Betriebsalarm</h1>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Bereich</p>`,
    `<p style="margin:0 0 16px;font-weight:bold">${escapeHtml(daten.category)}</p>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Problem</p>`,
    `<p style="margin:0 0 16px;font-weight:bold">${escapeHtml(daten.title)}</p>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Details</p>`,
    `<p style="margin:0 0 16px">${escapeHtml(daten.detail)}</p>`,
    `<p style="margin:0;color:#7c7770;font-size:13px">Kennung: ${escapeHtml(daten.key)}<br>Zeit: ${escapeHtml(daten.occurredAt)}</p>`,
  ].join(""), daten.shopUrl);

  return { subject: sanitizeSubject(`Betriebsalarm: ${daten.category} - ${daten.title}`), text, html };
}

// --- 1. Bestellbestätigung --------------------------------------------------

export type BestellPosition = { title: string; quantity: number; unitPrice: Betrag };

export type BestellDaten = {
  orderNumber: string;
  items: BestellPosition[];
  subtotal: Betrag;
  shipping: Betrag;
  total: Betrag;
  shopUrl: string;
  locale?: Locale;
};

export function orderConfirmation(daten: BestellDaten): Nachricht {
  if (daten.locale === "en") return orderConfirmationEnglish(daten);
  const zeilenText = daten.items
    .map((p) => `  ${p.quantity} × ${p.title}: ${formatMoney({ cents: p.unitPrice.cents * p.quantity, currency: p.unitPrice.currency })}`)
    .join("\n");

  const zeilenHtml = daten.items
    .map((p) => `<tr><td style="padding:6px 0">${escapeHtml(p.title)}${p.quantity > 1 ? ` <span style="color:#7c7770">× ${p.quantity}</span>` : ""}</td>`
      + `<td style="padding:6px 0;text-align:right;white-space:nowrap">${escapeHtml(formatMoney({ cents: p.unitPrice.cents * p.quantity, currency: p.unitPrice.currency }))}</td></tr>`)
    .join("");

  const text = [
    `Danke für deine Bestellung!`,
    ``,
    `Wir haben deine Zahlung erhalten und packen die Karten in den nächsten Tagen sorgfältig für dich ein.`,
    ``,
    `Bestellnummer: ${daten.orderNumber}`,
    ``,
    zeilenText,
    ``,
    `Zwischensumme: ${formatMoney(daten.subtotal)}`,
    `Versand:       ${formatMoney(daten.shipping)}`,
    `Gesamt:        ${formatMoney(daten.total)}`,
    ``,
    `Sobald das Paket unterwegs ist, melden wir uns noch einmal.`,
    `Wenn etwas unklar ist, antworte einfach auf diese E-Mail.`,
    ``,
    `Viele Grüße`,
    `die Brüder von BrandyCards`,
    fussText(daten.shopUrl),
  ].join("\n");

  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Danke für deine Bestellung!</h1>`,
    `<p style="margin:0 0 18px">Wir haben deine Zahlung erhalten und packen die Karten in den nächsten Tagen sorgfältig für dich ein.</p>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Bestellnummer</p>`,
    `<p style="margin:0 0 20px;font-weight:bold">${escapeHtml(daten.orderNumber)}</p>`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px">${zeilenHtml}</table>`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:14px;border-top:1px solid #e4e0d8">`,
    `<tr><td style="padding:8px 0">Zwischensumme</td><td style="padding:8px 0;text-align:right">${escapeHtml(formatMoney(daten.subtotal))}</td></tr>`,
    `<tr><td style="padding:0 0 8px">Versand</td><td style="padding:0 0 8px;text-align:right">${escapeHtml(formatMoney(daten.shipping))}</td></tr>`,
    `<tr><td style="padding:8px 0;border-top:1px solid #e4e0d8;font-weight:bold">Gesamt</td><td style="padding:8px 0;border-top:1px solid #e4e0d8;text-align:right;font-weight:bold">${escapeHtml(formatMoney(daten.total))}</td></tr>`,
    `</table>`,
    `<p style="margin:22px 0 0">Sobald das Paket unterwegs ist, melden wir uns noch einmal. Wenn etwas unklar ist, antworte einfach auf diese E-Mail.</p>`,
    `<p style="margin:18px 0 0">Viele Grüße<br>die Brüder von BrandyCards</p>`,
  ].join(""), daten.shopUrl);

  return { subject: sanitizeSubject(`Deine Bestellung ${daten.orderNumber} bei BrandyCards`), text, html };
}

// --- 1b. Versandbestätigung -------------------------------------------------

export type VersandDaten = {
  orderNumber: string;
  shippedAt: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shopUrl: string;
  locale?: Locale;
};

export function orderShipped(daten: VersandDaten): Nachricht {
  if (daten.locale === "en") return orderShippedEnglish(daten);
  const tracking = daten.trackingNumber
    ? [`Trackingnummer: ${daten.trackingNumber}`, ...(daten.carrier ? [`Versanddienstleister: ${daten.carrier}`] : []), ...(daten.trackingUrl ? ["", `Sendung verfolgen: ${daten.trackingUrl}`] : [])]
    : ["Eine Trackingnummer wurde nicht hinterlegt."];
  const text = [
    `Deine Bestellung ist unterwegs!`,
    ``,
    `Bestellnummer: ${daten.orderNumber}`,
    `Versendet am: ${formatDatum(daten.shippedAt)}`,
    ``,
    ...tracking,
    ``,
    `Wenn etwas unklar ist, antworte einfach auf diese E-Mail.`,
    ``,
    `Viele Grüße`,
    `die Brüder von BrandyCards`,
    fussText(daten.shopUrl),
  ].join("\n");
  const trackingHtml = daten.trackingNumber
    ? [
      `<p style="margin:0 0 8px"><strong>Trackingnummer:</strong> ${escapeHtml(daten.trackingNumber)}</p>`,
      ...(daten.carrier ? [`<p style="margin:0 0 8px"><strong>Versanddienstleister:</strong> ${escapeHtml(daten.carrier)}</p>`] : []),
      ...(daten.trackingUrl ? [`<p style="margin:16px 0 0"><a href="${escapeHtml(daten.trackingUrl)}" style="color:#c0472c;font-weight:bold">Sendung verfolgen</a></p>`] : []),
    ].join("")
    : `<p style="margin:0;color:#7c7770">Eine Trackingnummer wurde nicht hinterlegt.</p>`;
  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Deine Bestellung ist unterwegs!</h1>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Bestellnummer</p>`,
    `<p style="margin:0 0 6px;font-weight:bold">${escapeHtml(daten.orderNumber)}</p>`,
    `<p style="margin:0 0 20px;color:#7c7770;font-size:13px">Versendet am ${escapeHtml(formatDatum(daten.shippedAt))}</p>`,
    trackingHtml,
    `<p style="margin:22px 0 0">Wenn etwas unklar ist, antworte einfach auf diese E-Mail.</p>`,
    `<p style="margin:18px 0 0">Viele Grüße<br>die Brüder von BrandyCards</p>`,
  ].join(""), daten.shopUrl);
  return { subject: sanitizeSubject(`Deine Bestellung ${daten.orderNumber} ist unterwegs`), text, html };
}

export function orderRefunded(daten: { orderNumber: string; amount: Betrag; shopUrl: string; locale?: Locale }): Nachricht {
  if (daten.locale === "en") return orderRefundedEnglish(daten);
  const text = [
    `Deine Erstattung wurde bestätigt.`,
    ``,
    `Bestellnummer: ${daten.orderNumber}`,
    `Erstatteter Betrag: ${formatMoney(daten.amount)}`,
    ``,
    `PayPal verarbeitet die Rückzahlung auf die ursprüngliche Zahlungsquelle.`,
    ``,
    `Viele Grüße`,
    `die Brüder von BrandyCards`,
    fussText(daten.shopUrl),
  ].join("\n");
  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Deine Erstattung wurde bestätigt.</h1>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Bestellnummer</p>`,
    `<p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.orderNumber)}</p>`,
    `<p style="margin:0">Erstatteter Betrag: <strong>${escapeHtml(formatMoney(daten.amount))}</strong></p>`,
    `<p style="margin:22px 0 0">PayPal verarbeitet die Rückzahlung auf die ursprüngliche Zahlungsquelle.</p>`,
    `<p style="margin:18px 0 0">Viele Grüße<br>die Brüder von BrandyCards</p>`,
  ].join(""), daten.shopUrl);
  return { subject: sanitizeSubject(`Erstattung zu deiner Bestellung ${daten.orderNumber}`), text, html };
}

// --- 2. Preisvorschlag angenommen -------------------------------------------

export type AngebotDaten = {
  title: string;
  price: Betrag;
  /** ISO-Zeitpunkt, bis wann der Preis gilt. */
  expiresAt: string;
  productUrl: string;
  shopUrl: string;
  locale?: Locale;
};

export function offerAccepted(daten: AngebotDaten): Nachricht {
  if (daten.locale === "en") return offerAcceptedEnglish(daten);
  const gueltig = formatDatum(daten.expiresAt);
  const text = [
    `Dein Preisvorschlag ist angenommen.`,
    ``,
    `Karte:  ${daten.title}`,
    `Preis:  ${formatMoney(daten.price)}`,
    ...(gueltig ? [`Gültig: bis ${gueltig}`] : []),
    ``,
    `Du findest die Karte hier:`,
    daten.productUrl,
    ``,
    `Der ausgehandelte Preis wird beim Bestellen automatisch verwendet, du musst nichts weiter angeben.`,
    ``,
    `Viele Grüße`,
    `die Brüder von BrandyCards`,
    fussText(daten.shopUrl),
  ].join("\n");

  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Dein Preisvorschlag ist angenommen.</h1>`,
    `<p style="margin:0 0 6px;font-weight:bold">${escapeHtml(daten.title)}</p>`,
    `<p style="margin:0 0 18px;font-size:20px">${escapeHtml(formatMoney(daten.price))}</p>`,
    gueltig ? `<p style="margin:0 0 18px;color:#7c7770;font-size:13px">Gültig bis ${escapeHtml(gueltig)}</p>` : ``,
    `<p style="margin:0 0 22px"><a href="${escapeHtml(daten.productUrl)}" style="background:#c9362d;color:#fff;padding:12px 18px;text-decoration:none;display:inline-block">Zur Karte</a></p>`,
    `<p style="margin:0">Der ausgehandelte Preis wird beim Bestellen automatisch verwendet, du musst nichts weiter angeben.</p>`,
    `<p style="margin:18px 0 0">Viele Grüße<br>die Brüder von BrandyCards</p>`,
  ].join(""), daten.shopUrl);

  return { subject: sanitizeSubject(`Dein Preisvorschlag für ${daten.title} ist angenommen`), text, html };
}

// --- 3. Preisvorschlag abgelehnt --------------------------------------------

export function offerRejected(daten: { title: string; productUrl: string; shopUrl: string; locale?: Locale }): Nachricht {
  if (daten.locale === "en") return offerRejectedEnglish(daten);
  const text = [
    `Zu deinem Preisvorschlag`,
    ``,
    `Karte: ${daten.title}`,
    ``,
    `Diesmal können wir leider nicht zusagen. Bei dieser Karte liegt der Vorschlag zu weit unter dem, was wir vertreten können.`,
    `Die Karte ist weiterhin zum Listenpreis erhältlich, und ein neuer Vorschlag ist jederzeit willkommen.`,
    ``,
    daten.productUrl,
    ``,
    `Viele Grüße`,
    `die Brüder von BrandyCards`,
    fussText(daten.shopUrl),
  ].join("\n");

  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Zu deinem Preisvorschlag</h1>`,
    `<p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.title)}</p>`,
    `<p style="margin:0 0 14px">Diesmal können wir leider nicht zusagen. Bei dieser Karte liegt der Vorschlag zu weit unter dem, was wir vertreten können.</p>`,
    `<p style="margin:0 0 22px">Die Karte ist weiterhin zum Listenpreis erhältlich, und ein neuer Vorschlag ist jederzeit willkommen.</p>`,
    `<p style="margin:0 0 22px"><a href="${escapeHtml(daten.productUrl)}" style="color:#c9362d">Zur Karte</a></p>`,
    `<p style="margin:0">Viele Grüße<br>die Brüder von BrandyCards</p>`,
  ].join(""), daten.shopUrl);

  return { subject: sanitizeSubject(`Dein Preisvorschlag für ${daten.title}`), text, html };
}

// --- 4. Kartenanfrage eingegangen -------------------------------------------

export function inquiryReceived(daten: { title: string; shopUrl: string; locale?: Locale }): Nachricht {
  if (daten.locale === "en") return inquiryReceivedEnglish(daten);
  const text = [
    `Deine Anfrage ist da.`,
    ``,
    `Gesucht: ${daten.title}`,
    ``,
    `Wir sehen in unserem Bestand nach und melden uns, sobald wir etwas wissen. Das dauert in der Regel ein bis zwei Tage.`,
    ``,
    `Viele Grüße`,
    `die Brüder von BrandyCards`,
    fussText(daten.shopUrl),
  ].join("\n");

  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Deine Anfrage ist da.</h1>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Gesucht</p>`,
    `<p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.title)}</p>`,
    `<p style="margin:0">Wir sehen in unserem Bestand nach und melden uns, sobald wir etwas wissen. Das dauert in der Regel ein bis zwei Tage.</p>`,
    `<p style="margin:18px 0 0">Viele Grüße<br>die Brüder von BrandyCards</p>`,
  ].join(""), daten.shopUrl);

  return { subject: sanitizeSubject(`Deine Anfrage: ${daten.title}`), text, html };
}

// --- 5. Ankaufsangebot eingegangen ------------------------------------------

export function cardSubmissionReceived(daten: { title: string; shopUrl: string; locale?: Locale }): Nachricht {
  if (daten.locale === "en") return cardSubmissionReceivedEnglish(daten);
  const text = [
    `Danke für dein Angebot!`,
    ``,
    `Karte: ${daten.title}`,
    ``,
    `Wir schauen uns die Bilder in Ruhe an und melden uns mit einer Rückmeldung. Das dauert in der Regel ein bis zwei Tage.`,
    ``,
    `Viele Grüße`,
    `die Brüder von BrandyCards`,
    fussText(daten.shopUrl),
  ].join("\n");

  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Danke für dein Angebot!</h1>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Karte</p>`,
    `<p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.title)}</p>`,
    `<p style="margin:0">Wir schauen uns die Bilder in Ruhe an und melden uns mit einer Rückmeldung. Das dauert in der Regel ein bis zwei Tage.</p>`,
    `<p style="margin:18px 0 0">Viele Grüße<br>die Brüder von BrandyCards</p>`,
  ].join(""), daten.shopUrl);

  return { subject: sanitizeSubject(`Dein Kartenangebot: ${daten.title}`), text, html };
}

// --- 6. Verkäufernachricht: die Versanddaten --------------------------------

/** Die Lieferadresse, wie sie in `orders.shipping_address` steht. */
export type Lieferadresse = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

export type VerkaufDaten = {
  orderNumber: string;
  /** ISO-Zeitpunkt der Zahlung. */
  paidAt: string;
  items: BestellPosition[];
  subtotal: Betrag;
  shipping: Betrag;
  total: Betrag;
  address: Lieferadresse;
  /** Für Rückfragen — die Adresse, an die auch die Kundenbestätigung ging. */
  customerEmail: string;
  /** Ob vor dem Einzug bei eBay nachgesehen wurde, ob die Karte dort noch da ist.
   *
   * `OK` erzeugt **keinen** Hinweis. Eine Zeile „alles geprüft" in jeder
   * Nachricht stumpft ab; gewarnt wird nur, wenn es etwas zu warnen gibt.
   */
  bestandspruefung?: "OK" | "FEHLGESCHLAGEN" | "NICHT_GELAUFEN";
  shopUrl: string;
  locale?: Locale;
};

/** Der Warnsatz zur Bestandsprüfung — oder nichts, wenn alles geprüft ist.
 *
 * **Warum das in der Verkäufernachricht steht:** Die Prüfung an der Kasse lässt
 * bei einem eBay-Ausfall bewusst durch, sonst hielte eine eBay-Störung den
 * ganzen Shop an. Sie tut es aber lautlos — der Verkäufer packt die Karte ein,
 * ohne zu wissen, dass niemand nachgesehen hat, ob sie noch existiert. Hier ist
 * der letzte Moment, in dem er noch handeln kann.
 */
export function bestandshinweis(status: VerkaufDaten["bestandspruefung"], locale: Locale = "de"): string | null {
  if (!status || status === "OK") return null;
  if (locale === "en") {
    const reason = status === "FEHLGESCHLAGEN"
      ? "eBay did not respond to the request"
      : "the payment arrived through the PayPal webhook, which does not run this check";
    return `WARNING: We could not check whether the card was still available on eBay before payment. Reason: ${reason}. Please check manually before shipping.`;
  }
  const grund = status === "FEHLGESCHLAGEN"
    ? "eBay hat auf die Anfrage nicht geantwortet"
    : "die Zahlung kam über den PayPal-Webhook herein, der diese Prüfung nicht ausführt";
  return `ACHTUNG: Vor dem Einzug konnten wir nicht prüfen, ob die Karte bei eBay noch verfügbar ist. Grund: ${grund}. Bitte vor dem Versand kurz selbst nachsehen.`;
}

/** Die Nachricht an den Verkäufer, aus der ein Versandetikett entsteht.
 *
 * **Der Zweck ist ausschließlich der Versand.** Bis zum 2026-08-08 verschickte
 * der Shop nur eine Bestätigung an den Kunden; die Lieferadresse stand
 * ausschließlich in der Datenbank, und der Betreiber erfuhr von einer
 * Bestellung nur über PayPal — ohne zu wissen, wohin das Paket soll.
 *
 * Deshalb steht die Adresse hier **als Block am Anfang**, in der Reihenfolge,
 * in der sie auf ein Etikett gehört, und nicht zwischen Beträgen versteckt.
 */
export function sellerOrderNotification(daten: VerkaufDaten): Nachricht {
  if (daten.locale === "en") return sellerOrderNotificationEnglish(daten);
  const adresse = [
    daten.address.name,
    daten.address.street,
    `${daten.address.postalCode} ${daten.address.city}`,
    daten.address.country,
  ];

  const zeilenText = daten.items
    .map((p) => `  ${p.quantity} × ${p.title}: ${formatMoney({ cents: p.unitPrice.cents * p.quantity, currency: p.unitPrice.currency })}`)
    .join("\n");

  const text = [
    `Neue Bestellung: ${daten.orderNumber}`,
    ``,
    `Bezahlt am ${formatDatum(daten.paidAt)}.`,
    ``,
    `LIEFERADRESSE`,
    ...adresse.map((zeile) => `  ${zeile}`),
    ``,
    `INHALT`,
    zeilenText,
    ``,
    `Zwischensumme: ${formatMoney(daten.subtotal)}`,
    `Versand:       ${formatMoney(daten.shipping)}`,
    `Gesamt:        ${formatMoney(daten.total)}`,
    ``,
    `Kunde: ${daten.customerEmail}`,
    ...(bestandshinweis(daten.bestandspruefung) ? ["", bestandshinweis(daten.bestandspruefung) as string] : []),
    fussText(daten.shopUrl),
  ].join("\n");

  const zeilenHtml = daten.items
    .map((p) => `<tr><td style="padding:6px 0">${escapeHtml(p.title)}${p.quantity > 1 ? ` <span style="color:#7c7770">× ${p.quantity}</span>` : ""}</td>`
      + `<td style="padding:6px 0;text-align:right;white-space:nowrap">${escapeHtml(formatMoney({ cents: p.unitPrice.cents * p.quantity, currency: p.unitPrice.currency }))}</td></tr>`)
    .join("");

  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Neue Bestellung</h1>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Bestellnummer</p>`,
    `<p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.orderNumber)}</p>`,
    `<p style="margin:0 0 6px;color:#7c7770;font-size:13px">Lieferadresse</p>`,
    `<p style="margin:0 0 20px;font-size:16px;line-height:1.5">${adresse.map((zeile) => escapeHtml(zeile)).join("<br>")}</p>`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #e4e0d8">${zeilenHtml}</table>`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:14px;border-top:1px solid #e4e0d8">`,
    `<tr><td style="padding:8px 0">Zwischensumme</td><td style="padding:8px 0;text-align:right">${escapeHtml(formatMoney(daten.subtotal))}</td></tr>`,
    `<tr><td style="padding:0 0 8px">Versand</td><td style="padding:0 0 8px;text-align:right">${escapeHtml(formatMoney(daten.shipping))}</td></tr>`,
    `<tr><td style="padding:8px 0;border-top:1px solid #e4e0d8;font-weight:bold">Gesamt</td><td style="padding:8px 0;border-top:1px solid #e4e0d8;text-align:right;font-weight:bold">${escapeHtml(formatMoney(daten.total))}</td></tr>`,
    `</table>`,
    `<p style="margin:20px 0 0;color:#7c7770;font-size:13px">Bezahlt am ${escapeHtml(formatDatum(daten.paidAt))} · Kunde: ${escapeHtml(daten.customerEmail)}</p>`,
    // Auffällig gesetzt: Dieser Hinweis kommt selten und muss dann gesehen werden.
    ...(bestandshinweis(daten.bestandspruefung)
      ? [`<p style="margin:18px 0 0;padding:12px;background:#fdf1ec;border-left:3px solid #c0472c;font-size:14px;line-height:1.5">${escapeHtml(bestandshinweis(daten.bestandspruefung) as string)}</p>`]
      : []),
  ].join(""), daten.shopUrl);

  return { subject: sanitizeSubject(`Neue Bestellung ${daten.orderNumber} von ${daten.address.name}`), text, html };
}

// --- 7. Konto gelöscht ------------------------------------------------------

/** Bestätigung der Kontolöschung.
 *
 * Muss **nach** der Löschung verschickt werden, aber an eine Adresse, die
 * vorher gemerkt wurde — nach dem Löschlauf gibt es keine Zeile mehr, aus der
 * sich der Empfänger nachschlagen ließe.
 *
 * Der Hinweis auf verbleibende Bestelldaten steht bewusst darin: Wer „Konto
 * löschen" klickt und später erfährt, dass Rechnungen weiterhin gespeichert
 * sind, fühlt sich getäuscht. Rechtsgrundlage ist Art. 17 Abs. 3 lit. b DSGVO.
 */
function englishEmail(subject: string, lines: string[], body: string, shopUrl: string): Nachricht {
  return {
    subject: sanitizeSubject(subject),
    text: [...lines, fussText(shopUrl, "en")].join("\n"),
    html: rahmen(body, shopUrl, "en"),
  };
}

function orderConfirmationEnglish(daten: BestellDaten): Nachricht {
  const itemsText = daten.items.map((p) => `  ${p.quantity} × ${p.title}: ${formatMoney({ cents: p.unitPrice.cents * p.quantity, currency: p.unitPrice.currency }, "en")}`).join("\n");
  const itemsHtml = daten.items.map((p) => `<tr><td style="padding:6px 0">${escapeHtml(p.title)}${p.quantity > 1 ? ` <span style="color:#7c7770">× ${p.quantity}</span>` : ""}</td><td style="padding:6px 0;text-align:right;white-space:nowrap">${escapeHtml(formatMoney({ cents: p.unitPrice.cents * p.quantity, currency: p.unitPrice.currency }, "en"))}</td></tr>`).join("");
  const summaryHtml = `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:14px;border-top:1px solid #e4e0d8"><tr><td style="padding:8px 0">Subtotal</td><td style="padding:8px 0;text-align:right">${escapeHtml(formatMoney(daten.subtotal, "en"))}</td></tr><tr><td style="padding:0 0 8px">Shipping</td><td style="padding:0 0 8px;text-align:right">${escapeHtml(formatMoney(daten.shipping, "en"))}</td></tr><tr><td style="padding:8px 0;border-top:1px solid #e4e0d8;font-weight:bold">Total</td><td style="padding:8px 0;border-top:1px solid #e4e0d8;text-align:right;font-weight:bold">${escapeHtml(formatMoney(daten.total, "en"))}</td></tr></table>`;
  return englishEmail(`Your BrandyCards order ${daten.orderNumber}`, [
    `Thank you for your order!`, ``, `We have received your payment and will carefully pack your cards in the next few days.`, ``,
    `Order number: ${daten.orderNumber}`, ``, itemsText, ``,
    `Subtotal: ${formatMoney(daten.subtotal, "en")}`, `Shipping: ${formatMoney(daten.shipping, "en")}`, `Total: ${formatMoney(daten.total, "en")}`, ``,
    `We will contact you again as soon as your parcel is on its way.`, `If anything is unclear, simply reply to this email.`, ``, `Best wishes`, `the BrandyCards brothers`,
  ], `<h1 style="font-size:22px;margin:0 0 16px">Thank you for your order!</h1><p style="margin:0 0 18px">We have received your payment and will carefully pack your cards in the next few days.</p><p style="margin:0 0 6px;color:#7c7770;font-size:13px">Order number</p><p style="margin:0 0 20px;font-weight:bold">${escapeHtml(daten.orderNumber)}</p><table style="width:100%;border-collapse:collapse;font-size:14px">${itemsHtml}</table>${summaryHtml}<p style="margin:22px 0 0">We will contact you again as soon as your parcel is on its way. If anything is unclear, simply reply to this email.</p><p style="margin:18px 0 0">Best wishes<br>the BrandyCards brothers</p>`, daten.shopUrl);
}

function orderShippedEnglish(daten: VersandDaten): Nachricht {
  const trackingText = daten.trackingNumber ? [`Tracking number: ${daten.trackingNumber}`, ...(daten.carrier ? [`Shipping carrier: ${daten.carrier}`] : []), ...(daten.trackingUrl ? ["", `Track shipment: ${daten.trackingUrl}`] : [])] : ["No tracking number was provided."];
  const trackingHtml = daten.trackingNumber ? `<p style="margin:0 0 8px"><strong>Tracking number:</strong> ${escapeHtml(daten.trackingNumber)}</p>${daten.carrier ? `<p style="margin:0 0 8px"><strong>Shipping carrier:</strong> ${escapeHtml(daten.carrier)}</p>` : ""}${daten.trackingUrl ? `<p style="margin:16px 0 0"><a href="${escapeHtml(daten.trackingUrl)}" style="color:#c0472c;font-weight:bold">Track shipment</a></p>` : ""}` : `<p style="margin:0;color:#7c7770">No tracking number was provided.</p>`;
  return englishEmail(`Your order ${daten.orderNumber} is on its way`, [`Your order is on its way!`, ``, `Order number: ${daten.orderNumber}`, `Shipped on: ${formatDatum(daten.shippedAt, "en")}`, ``, ...trackingText, ``, `If anything is unclear, simply reply to this email.`, ``, `Best wishes`, `the BrandyCards brothers`], `<h1 style="font-size:22px;margin:0 0 16px">Your order is on its way!</h1><p style="margin:0 0 6px;color:#7c7770;font-size:13px">Order number</p><p style="margin:0 0 6px;font-weight:bold">${escapeHtml(daten.orderNumber)}</p><p style="margin:0 0 20px;color:#7c7770;font-size:13px">Shipped on ${escapeHtml(formatDatum(daten.shippedAt, "en"))}</p>${trackingHtml}<p style="margin:22px 0 0">If anything is unclear, simply reply to this email.</p><p style="margin:18px 0 0">Best wishes<br>the BrandyCards brothers</p>`, daten.shopUrl);
}

function orderRefundedEnglish(daten: { orderNumber: string; amount: Betrag; shopUrl: string; locale?: Locale }): Nachricht {
  return englishEmail(`Refund for your order ${daten.orderNumber}`, [`Your refund has been confirmed.`, ``, `Order number: ${daten.orderNumber}`, `Refunded amount: ${formatMoney(daten.amount, "en")}`, ``, `PayPal will process the refund to the original payment method.`, ``, `Best wishes`, `the BrandyCards brothers`], `<h1 style="font-size:22px;margin:0 0 16px">Your refund has been confirmed.</h1><p style="margin:0 0 6px;color:#7c7770;font-size:13px">Order number</p><p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.orderNumber)}</p><p style="margin:0">Refunded amount: <strong>${escapeHtml(formatMoney(daten.amount, "en"))}</strong></p><p style="margin:22px 0 0">PayPal will process the refund to the original payment method.</p><p style="margin:18px 0 0">Best wishes<br>the BrandyCards brothers</p>`, daten.shopUrl);
}

function offerAcceptedEnglish(daten: AngebotDaten): Nachricht {
  const validUntil = formatDatum(daten.expiresAt, "en");
  return englishEmail(`Your offer for ${daten.title} was accepted`, [`Your offer has been accepted.`, ``, `Card: ${daten.title}`, `Price: ${formatMoney(daten.price, "en")}`, ...(validUntil ? [`Valid until: ${validUntil}`] : []), ``, `You can find the card here:`, daten.productUrl, ``, `The agreed price will be applied automatically when you order; you do not need to enter anything else.`, ``, `Best wishes`, `the BrandyCards brothers`], `<h1 style="font-size:22px;margin:0 0 16px">Your offer has been accepted.</h1><p style="margin:0 0 6px;font-weight:bold">${escapeHtml(daten.title)}</p><p style="margin:0 0 18px;font-size:20px">${escapeHtml(formatMoney(daten.price, "en"))}</p>${validUntil ? `<p style="margin:0 0 18px;color:#7c7770;font-size:13px">Valid until ${escapeHtml(validUntil)}</p>` : ""}<p style="margin:0 0 22px"><a href="${escapeHtml(daten.productUrl)}" style="background:#c9362d;color:#fff;padding:12px 18px;text-decoration:none;display:inline-block">View card</a></p><p style="margin:0">The agreed price will be applied automatically when you order; you do not need to enter anything else.</p><p style="margin:18px 0 0">Best wishes<br>the BrandyCards brothers</p>`, daten.shopUrl);
}

function offerRejectedEnglish(daten: { title: string; productUrl: string; shopUrl: string; locale?: Locale }): Nachricht {
  return englishEmail(`Your offer for ${daten.title}`, [`About your offer`, ``, `Card: ${daten.title}`, ``, `Unfortunately, we cannot accept it this time. The offer is too far below the price we can stand behind.`, `The card is still available at the listed price, and you are welcome to make another offer at any time.`, ``, daten.productUrl, ``, `Best wishes`, `the BrandyCards brothers`], `<h1 style="font-size:22px;margin:0 0 16px">About your offer</h1><p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.title)}</p><p style="margin:0 0 14px">Unfortunately, we cannot accept it this time. The offer is too far below the price we can stand behind.</p><p style="margin:0 0 22px">The card is still available at the listed price, and you are welcome to make another offer at any time.</p><p style="margin:0 0 22px"><a href="${escapeHtml(daten.productUrl)}" style="color:#c9362d">View card</a></p><p style="margin:0">Best wishes<br>the BrandyCards brothers</p>`, daten.shopUrl);
}

function inquiryReceivedEnglish(daten: { title: string; shopUrl: string; locale?: Locale }): Nachricht {
  return englishEmail(`Your request: ${daten.title}`, [`Your request is here.`, ``, `Looking for: ${daten.title}`, ``, `We will check our collection and get back to you as soon as we know more. This usually takes one or two days.`, ``, `Best wishes`, `the BrandyCards brothers`], `<h1 style="font-size:22px;margin:0 0 16px">Your request is here.</h1><p style="margin:0 0 6px;color:#7c7770;font-size:13px">Looking for</p><p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.title)}</p><p style="margin:0">We will check our collection and get back to you as soon as we know more. This usually takes one or two days.</p><p style="margin:18px 0 0">Best wishes<br>the BrandyCards brothers</p>`, daten.shopUrl);
}

function cardSubmissionReceivedEnglish(daten: { title: string; shopUrl: string; locale?: Locale }): Nachricht {
  return englishEmail(`Your card offer: ${daten.title}`, [`Thank you for your offer!`, ``, `Card: ${daten.title}`, ``, `We will review the pictures and get back to you. This usually takes one or two days.`, ``, `Best wishes`, `the BrandyCards brothers`], `<h1 style="font-size:22px;margin:0 0 16px">Thank you for your offer!</h1><p style="margin:0 0 6px;color:#7c7770;font-size:13px">Card</p><p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.title)}</p><p style="margin:0">We will review the pictures and get back to you. This usually takes one or two days.</p><p style="margin:18px 0 0">Best wishes<br>the BrandyCards brothers</p>`, daten.shopUrl);
}

function sellerOrderNotificationEnglish(daten: VerkaufDaten): Nachricht {
  const address = [daten.address.name, daten.address.street, `${daten.address.postalCode} ${daten.address.city}`, daten.address.country];
  const itemsText = daten.items.map((p) => `  ${p.quantity} × ${p.title}: ${formatMoney({ cents: p.unitPrice.cents * p.quantity, currency: p.unitPrice.currency }, "en")}`).join("\n");
  const itemsHtml = daten.items.map((p) => `<tr><td style="padding:6px 0">${escapeHtml(p.title)}${p.quantity > 1 ? ` <span style="color:#7c7770">× ${p.quantity}</span>` : ""}</td><td style="padding:6px 0;text-align:right;white-space:nowrap">${escapeHtml(formatMoney({ cents: p.unitPrice.cents * p.quantity, currency: p.unitPrice.currency }, "en"))}</td></tr>`).join("");
  const warning = bestandshinweis(daten.bestandspruefung, "en");
  return englishEmail(`New order ${daten.orderNumber} from ${daten.address.name}`, [`New order: ${daten.orderNumber}`, ``, `Paid on ${formatDatum(daten.paidAt, "en")}.`, ``, `DELIVERY ADDRESS`, ...address.map((line) => `  ${line}`), ``, `CONTENTS`, itemsText, ``, `Subtotal: ${formatMoney(daten.subtotal, "en")}`, `Shipping: ${formatMoney(daten.shipping, "en")}`, `Total: ${formatMoney(daten.total, "en")}`, ``, `Customer: ${daten.customerEmail}`, ...(warning ? ["", warning] : [])], `<h1 style="font-size:22px;margin:0 0 16px">New order</h1><p style="margin:0 0 6px;color:#7c7770;font-size:13px">Order number</p><p style="margin:0 0 18px;font-weight:bold">${escapeHtml(daten.orderNumber)}</p><p style="margin:0 0 6px;color:#7c7770;font-size:13px">Delivery address</p><p style="margin:0 0 20px;font-size:16px;line-height:1.5">${address.map((line) => escapeHtml(line)).join("<br>")}</p><table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #e4e0d8">${itemsHtml}</table><table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:14px;border-top:1px solid #e4e0d8"><tr><td style="padding:8px 0">Subtotal</td><td style="padding:8px 0;text-align:right">${escapeHtml(formatMoney(daten.subtotal, "en"))}</td></tr><tr><td style="padding:0 0 8px">Shipping</td><td style="padding:0 0 8px;text-align:right">${escapeHtml(formatMoney(daten.shipping, "en"))}</td></tr><tr><td style="padding:8px 0;border-top:1px solid #e4e0d8;font-weight:bold">Total</td><td style="padding:8px 0;border-top:1px solid #e4e0d8;text-align:right;font-weight:bold">${escapeHtml(formatMoney(daten.total, "en"))}</td></tr></table><p style="margin:20px 0 0;color:#7c7770;font-size:13px">Paid on ${escapeHtml(formatDatum(daten.paidAt, "en"))} · Customer: ${escapeHtml(daten.customerEmail)}</p>${warning ? `<p style="margin:18px 0 0;padding:12px;background:#fdf1ec;border-left:3px solid #c0472c;font-size:14px;line-height:1.5">${escapeHtml(warning)}</p>` : ""}`, daten.shopUrl);
}

function accountDeletedEnglish(daten: { bestellungen: number; shopUrl: string; locale?: Locale }): Nachricht {
  const notice = daten.bestellungen > 0 ? `Your ${daten.bestellungen === 1 ? "order remains" : `${daten.bestellungen} orders remain`} stored as an invoice record. We are legally required to keep them. They are no longer linked to your account.` : `There were no orders that we needed to retain.`;
  return englishEmail("Your BrandyCards account has been deleted", [`Your account has been deleted.`, ``, `We removed your BrandyCards account and all related data: requests, card submissions with pictures and price offers. Your sign-in has also been deleted.`, ``, notice, ``, `If you would like to shop with us again later, you can create a new account at any time.`, ``, `Best wishes`, `the BrandyCards brothers`], `<h1 style="font-size:22px;margin:0 0 16px">Your account has been deleted.</h1><p style="margin:0 0 14px">We removed your BrandyCards account and all related data: requests, card submissions with pictures and price offers. Your sign-in has also been deleted.</p><p style="margin:0 0 14px;color:#7c7770;font-size:13px">${escapeHtml(notice)}</p><p style="margin:0">If you would like to shop with us again later, you can create a new account at any time.</p><p style="margin:18px 0 0">Best wishes<br>the BrandyCards brothers</p>`, daten.shopUrl);
}

export function accountDeleted(daten: { bestellungen: number; shopUrl: string; locale?: Locale }): Nachricht {
  if (daten.locale === "en") return accountDeletedEnglish(daten);
  const hinweis = daten.bestellungen > 0
    ? `Deine ${daten.bestellungen === 1 ? "Bestellung bleibt" : `${daten.bestellungen} Bestellungen bleiben`} als Rechnungsbeleg gespeichert. Dazu sind wir gesetzlich verpflichtet. Die Verknüpfung zu deinem Konto ist aufgehoben.`
    : `Es lagen keine Bestellungen vor, die wir aufbewahren müssten.`;

  const text = [
    `Dein Konto ist gelöscht.`,
    ``,
    `Wir haben dein Konto bei BrandyCards und alle Daten dazu entfernt: Anfragen, Kartenangebote samt Bildern und Preisvorschläge. Auch deine Anmeldung ist gelöscht.`,
    ``,
    hinweis,
    ``,
    `Wenn du später wieder bei uns kaufen möchtest, kannst du jederzeit ein neues Konto anlegen.`,
    ``,
    `Viele Grüße`,
    `die Brüder von BrandyCards`,
    fussText(daten.shopUrl),
  ].join("\n");

  const html = rahmen([
    `<h1 style="font-size:22px;margin:0 0 16px">Dein Konto ist gelöscht.</h1>`,
    `<p style="margin:0 0 14px">Wir haben dein Konto bei BrandyCards und alle Daten dazu entfernt: Anfragen, Kartenangebote samt Bildern und Preisvorschläge. Auch deine Anmeldung ist gelöscht.</p>`,
    `<p style="margin:0 0 14px;color:#7c7770;font-size:13px">${escapeHtml(hinweis)}</p>`,
    `<p style="margin:0">Wenn du später wieder bei uns kaufen möchtest, kannst du jederzeit ein neues Konto anlegen.</p>`,
    `<p style="margin:18px 0 0">Viele Grüße<br>die Brüder von BrandyCards</p>`,
  ].join(""), daten.shopUrl);

  return { subject: sanitizeSubject("Dein BrandyCards-Konto wurde gelöscht"), text, html };
}
