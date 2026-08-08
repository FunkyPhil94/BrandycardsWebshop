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

export function formatMoney({ cents, currency }: Betrag): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

function formatDatum(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" }).format(datum);
}

/** Gemeinsamer Rahmen. Bewusst schlicht: Postfächer werfen Stilangaben im Kopf
 *  weg, deshalb stehen die wenigen Angaben direkt am Element. */
function rahmen(inhalt: string, shopUrl: string): string {
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111112;max-width:560px">`,
    inhalt,
    `<hr style="border:0;border-top:1px solid #e4e0d8;margin:28px 0 14px">`,
    `<p style="font-size:12px;color:#7c7770;margin:0">`,
    `BrandyCards · Leverkusen · `,
    `<a href="${escapeHtml(shopUrl)}/impressum" style="color:#7c7770">Impressum</a> · `,
    `<a href="${escapeHtml(shopUrl)}/datenschutz" style="color:#7c7770">Datenschutz</a>`,
    `</p>`,
    `</div>`,
  ].join("");
}

function fussText(shopUrl: string): string {
  return `\n\n--\nBrandyCards · Leverkusen\nImpressum: ${shopUrl}/impressum\nDatenschutz: ${shopUrl}/datenschutz\n`;
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
};

export function orderConfirmation(daten: BestellDaten): Nachricht {
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

// --- 2. Preisvorschlag angenommen -------------------------------------------

export type AngebotDaten = {
  title: string;
  price: Betrag;
  /** ISO-Zeitpunkt, bis wann der Preis gilt. */
  expiresAt: string;
  productUrl: string;
  shopUrl: string;
};

export function offerAccepted(daten: AngebotDaten): Nachricht {
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

export function offerRejected(daten: { title: string; productUrl: string; shopUrl: string }): Nachricht {
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

export function inquiryReceived(daten: { title: string; shopUrl: string }): Nachricht {
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

export function cardSubmissionReceived(daten: { title: string; shopUrl: string }): Nachricht {
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
};

/** Der Warnsatz zur Bestandsprüfung — oder nichts, wenn alles geprüft ist.
 *
 * **Warum das in der Verkäufernachricht steht:** Die Prüfung an der Kasse lässt
 * bei einem eBay-Ausfall bewusst durch, sonst hielte eine eBay-Störung den
 * ganzen Shop an. Sie tut es aber lautlos — der Verkäufer packt die Karte ein,
 * ohne zu wissen, dass niemand nachgesehen hat, ob sie noch existiert. Hier ist
 * der letzte Moment, in dem er noch handeln kann.
 */
export function bestandshinweis(status: VerkaufDaten["bestandspruefung"]): string | null {
  if (!status || status === "OK") return null;
  const grund = status === "FEHLGESCHLAGEN"
    ? "eBay hat auf die Anfrage nicht geantwortet"
    : "die Zahlung kam über den PayPal-Webhook herein, der diese Prüfung nicht ausführt";
  return `ACHTUNG: Vor dem Einzug konnte nicht geprüft werden, ob die Karte bei eBay noch verfügbar ist — ${grund}. Bitte vor dem Versand kurz selbst nachsehen.`;
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

  return { subject: sanitizeSubject(`Neue Bestellung ${daten.orderNumber} — ${daten.address.name}`), text, html };
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
export function accountDeleted(daten: { bestellungen: number; shopUrl: string }): Nachricht {
  const hinweis = daten.bestellungen > 0
    ? `Deine ${daten.bestellungen === 1 ? "Bestellung bleibt" : `${daten.bestellungen} Bestellungen bleiben`} als Rechnungsbeleg gespeichert — dazu sind wir gesetzlich verpflichtet. Die Verknüpfung zu deinem Konto ist aufgehoben.`
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
