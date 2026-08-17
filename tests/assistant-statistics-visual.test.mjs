import assert from "node:assert/strict";
import test from "node:test";

const { baueTagesreihe, MAX_TAGES_SAEULEN } = await import("../lib/assistant/statistics-series.ts");
const { rendereStatistikAnsicht } = await import("../lib/assistant/statistics-visual.ts");

const JETZT = new Date("2026-08-17T12:00:00.000Z");

const verkauf = (ueberschreibung = {}) => ({
  days: 7,
  since: "2026-08-11T00:00:00.000Z",
  revenueBasis: "Bruttoumsatz vor eBay-Gebühren.",
  currency: "EUR",
  channels: {
    shop: { available: true, orderCount: 1, itemCount: 1, revenueCents: 500, currency: "EUR", unavailableCode: null, unavailableMessage: null },
    ebay: { available: true, orderCount: 2, itemCount: 2, revenueCents: 2500, currency: "EUR", unavailableCode: null, unavailableMessage: null },
  },
  totalRevenueCents: 3000,
  totalItemCount: 3,
  sales: [
    { channel: "SHOP", reference: "BC-1", title: "A", quantity: 1, amountCents: 500, currency: "EUR", soldAt: "2026-08-12T10:00:00.000Z" },
    { channel: "EBAY", reference: "E-1", title: "B", quantity: 2, amountCents: 2500, currency: "EUR", soldAt: "2026-08-15T10:00:00.000Z" },
  ],
  ...ueberschreibung,
});

const kennzahlen = {
  generatedAt: "2026-08-17T12:00:00.000Z",
  sellableCards: 277, openShopOffers: 0, actionableOrders: 4,
  newShopInquiries: 0, unresolvedEbayJobs: 0,
  latestEbaySyncStatus: "SUCCEEDED", latestEbaySyncAt: "2026-08-17T11:00:00.000Z",
};

test("die Tagesreihe ist lückenlos, auch wo nichts verkauft wurde", () => {
  // Ein Tag ohne Verkauf ist eine Aussage. Wuerden nur Tage mit Verkaeufen
  // gezeichnet, stuenden zwei Saeulen mit Wochen Abstand nebeneinander und der
  // Verlauf waere frei erfunden.
  const reihe = baueTagesreihe(verkauf(), JETZT);
  assert.equal(reihe.tage.length, 7, "11.08. bis 17.08. sind sieben Tage");
  assert.deepEqual(reihe.tage.map((t) => t.tag), [
    "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17",
  ]);
  assert.equal(reihe.tage.filter((t) => t.shopCents + t.ebayCents === 0).length, 5);
});

test("die Kanäle landen getrennt im richtigen Tag", () => {
  const reihe = baueTagesreihe(verkauf(), JETZT);
  const zwoelfter = reihe.tage.find((t) => t.tag === "2026-08-12");
  const fuenfzehnter = reihe.tage.find((t) => t.tag === "2026-08-15");
  assert.deepEqual([zwoelfter.shopCents, zwoelfter.ebayCents], [500, 0]);
  assert.deepEqual([fuenfzehnter.shopCents, fuenfzehnter.ebayCents], [0, 2500]);
  assert.equal(fuenfzehnter.ebayStueck, 2);
});

test("Verkäufe ohne Datum werden gezählt, nicht verschluckt", () => {
  // Sonst ergaebe die Summe der Saeulen weniger als die Kennzahl darueber, und
  // niemand wuesste warum.
  const daten = verkauf();
  daten.sales.push({ channel: "EBAY", reference: "E-2", title: "C", quantity: 1, amountCents: 900, currency: "EUR", soldAt: null });
  daten.sales.push({ channel: "EBAY", reference: "E-3", title: "D", quantity: 1, amountCents: 900, currency: "EUR", soldAt: "kein Datum" });
  const reihe = baueTagesreihe(daten, JETZT);
  assert.equal(reihe.ohneDatum, 2);
});

test("ein Verkauf außerhalb des Fensters gehört nicht in die Reihe", () => {
  const daten = verkauf();
  daten.sales.push({ channel: "EBAY", reference: "alt", title: "X", quantity: 1, amountCents: 4000, currency: "EUR", soldAt: "2026-05-01T10:00:00.000Z" });
  const reihe = baueTagesreihe(daten, JETZT);
  assert.equal(reihe.tage.length, 7, "das Fenster waechst nicht rueckwaerts");
  assert.equal(reihe.ohneDatum, 0, "er hat ein Datum -- er wurde nur nicht angefragt");
  assert.equal(reihe.tage.reduce((a, t) => a + t.ebayCents, 0), 2500);
});

test("fehlende Menge gilt als eins, fehlender Betrag als null", () => {
  const daten = verkauf({ sales: [
    { channel: "EBAY", reference: "E", title: "B", quantity: null, amountCents: null, currency: "EUR", soldAt: "2026-08-13T10:00:00.000Z" },
  ] });
  const tag = baueTagesreihe(daten, JETZT).tage.find((t) => t.tag === "2026-08-13");
  assert.equal(tag.ebayStueck, 1, "eine Karte ist die sichere Annahme");
  assert.equal(tag.ebayCents, 0, "ein Betrag wird nicht erfunden");
});

test("ohne Daten entsteht kein Dokument", () => {
  assert.equal(rendereStatistikAnsicht({}), null);
});

test("genau eine Leitzahl, und keine aus halber Grundlage", () => {
  const mit = rendereStatistikAnsicht({ verkauf: verkauf() });
  assert.equal((mit.match(/class="hero"/gu) ?? []).length, 1, "genau eine Leitzahl je Ansicht");
  assert.match(mit, /30,00 €/u);

  // `null` heisst „eine Haelfte fehlt" -- eine Gesamtsumme daraus waere
  // schlimmer als keine.
  const ohne = rendereStatistikAnsicht({ verkauf: verkauf({ totalRevenueCents: null }) });
  assert.match(ohne, /unvollständig/u);
});

test("Legende und Tabellenansicht sind Pflicht, nicht Zierde", () => {
  // Der Validator meldete fuer das Orange auf heller Flaeche 2,76:1 -- unter
  // 3:1. Das verpflichtet laut Verfahren zu sichtbaren Labels UND einer
  // Tabellenansicht. Beides muss vorhanden bleiben.
  const html = rendereStatistikAnsicht({ verkauf: verkauf(), kennzahlen });
  assert.match(html, /class="legende"/u);
  assert.match(html, /class="key"><span class="swatch s-shop"><\/span>Shop/u);
  assert.match(html, /class="key"><span class="swatch s-ebay"><\/span>eBay/u);
  assert.match(html, /<details class="tabelle">/u);
  assert.match(html, /Zahlen als Tabelle/u);
});

test("eine Metrik zur Zeit — niemals zwei y-Achsen", () => {
  // Der haeufigste Diagrammfehler: Die Ausrichtung zweier Skalen erfindet eine
  // Korrelation. Umsatz und Stueckzahl werden deshalb umgeschaltet.
  const html = rendereStatistikAnsicht({ verkauf: verkauf() });
  assert.match(html, /data-metrik="umsatz"/u);
  assert.match(html, /data-metrik="stueck"/u);
  // Jede Ansicht ist eine eigene, fertig gezeichnete Gruppe mit **einer** Skala.
  // Zwei Skalen in einer Gruppe kann es damit gar nicht geben.
  assert.match(html, /data-sicht="7-umsatz"/u);
  assert.match(html, /data-sicht="7-stueck"/u);
  assert.doesNotMatch(html, /y2Achse|rechteAchse|secondAxis/u);
});

test("die Verdichtungsschwelle verlässt den Server gar nicht", () => {
  // Seit alle Ansichten serverseitig gezeichnet werden, wird die Schwelle nur
  // noch hier angewandt -- sie steht genau einmal, in statistics-series.ts, und
  // reist nicht mit. Zwei Kopien liefen auseinander, und dann zeigte „7 Tage"
  // ploetzlich Wochensaeulen.
  assert.equal(typeof MAX_TAGES_SAEULEN, "number");
  const html = rendereStatistikAnsicht({ verkauf: verkauf() });
  assert.doesNotMatch(html, /MAX_TAGES_SAEULEN/u);
});

test("das Skript zeichnet nichts — ohne JavaScript steht das Diagramm trotzdem", () => {
  // **Der Befund vom 2026-08-17**: Eine Vorschau ohne Skript zeigte Kacheln und
  // Kartenrahmen, aber einen leeren Diagrammbereich. Seitdem sind alle Ansichten
  // fertig gerendert; das Skript schaltet nur um.
  const html = rendereStatistikAnsicht({ verkauf: verkauf() });
  const skript = html.slice(html.indexOf("<script>"));
  assert.doesNotMatch(skript, /createElementNS|appendChild\(el\(|new Path2D/u,
    "im Skript darf keine Zeichenlogik stehen");
  assert.match(skript, /Das Skript zeichnet nichts/u);
  // Vor dem Skript stehen bereits Saeulen im Dokument.
  const vorSkript = html.slice(0, html.indexOf("<script>"));
  assert.ok((vorSkript.match(/<rect /gu) ?? []).length > 3, "die Saeulen sind schon da");
});

test("das Dokument lädt nichts aus dem Netz und trägt eine CSP", () => {
  const html = rendereStatistikAnsicht({ verkauf: verkauf(), kennzahlen });
  assert.match(html, /Content-Security-Policy/u);
  assert.match(html, /default-src 'none'/u);
  // Keine externen Quellen -- die WebView haette ohnehin keinen Zugang.
  assert.doesNotMatch(html, /(src|href)="https?:/u);
  assert.doesNotMatch(html, /@import|fonts\.googleapis/u);
});

test("Gitterlinien sind durchgezogene Haarlinien, keine gestrichelten", () => {
  const html = rendereStatistikAnsicht({ verkauf: verkauf() });
  assert.doesNotMatch(html, /stroke-dasharray/u);
  assert.match(html, /stroke="var\(--grid\)" stroke-width="1"/u);
});

test("beide Farbmodi sind gesetzt, keiner ist ein automatischer Umschlag", () => {
  const html = rendereStatistikAnsicht({ verkauf: verkauf() });
  // Hell als Vorgabe, dunkel als eigene, gegen die dunkle Flaeche gemessene Stufen.
  assert.match(html, /--surface: #F1EEE8;/u);
  assert.match(html, /--surface: #383838;/u);
  assert.match(html, /--s-shop: #2a78d6;/u);
  assert.match(html, /--s-ebay: #eb6834;/u);
  assert.match(html, /--s-shop: #3987e5;/u);
  assert.match(html, /--s-ebay: #d95926;/u);
  assert.match(html, /prefers-color-scheme: dark/u);
});

test("Text trägt Textfarben, nie die Serienfarbe", () => {
  const html = rendereStatistikAnsicht({ verkauf: verkauf() });
  // Achsen- und Wertbeschriftungen greifen auf Ink-Rollen zu.
  assert.match(html, /<text [^>]*fill="var\(--muted\)"/u);
  assert.match(html, /<text [^>]*fill="var\(--ink\)"/u);
  // Und nirgends trägt Text eine Serienfarbe — Identität kommt vom farbigen
  // Plättchen daneben, nie von eingefärbter Schrift.
  assert.doesNotMatch(html, /color: var\(--s-(shop|ebay)\)/u);
  assert.doesNotMatch(html, /<text [^>]*fill="var\(--s-/u);
});

test("Fremdtext wird maskiert und kann das Dokument nicht verlassen", () => {
  const boshaft = verkauf({ revenueBasis: '</style><script>alert(1)</script>"' });
  const html = rendereStatistikAnsicht({ verkauf: boshaft });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/u);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
});

test("eingebettete Daten können den Skriptkontext nicht verlassen", () => {
  const boshaft = verkauf({ sales: [
    { channel: "EBAY", reference: "</script><script>alert(1)</script>", title: "x", quantity: 1, amountCents: 1, currency: "EUR", soldAt: "2026-08-13T10:00:00.000Z" },
  ] });
  const html = rendereStatistikAnsicht({ verkauf: boshaft });
  assert.doesNotMatch(html, /<\/script><script>alert/u);
});

test("nicht gelesene Kanäle sagen das, statt eine Null zu zeigen", () => {
  // Dieselbe Linie wie überall: „nichts da" ist nicht „nicht nachgesehen".
  const daten = verkauf();
  daten.channels.ebay = { available: false, orderCount: 0, itemCount: 0, revenueCents: null, currency: "EUR", unavailableCode: "SCOPE_NOT_GRANTED", unavailableMessage: "x" };
  const html = rendereStatistikAnsicht({ verkauf: daten });
  assert.match(html, /nicht gelesen \(SCOPE_NOT_GRANTED\)/u);
});

test("Kennzahlen allein ergeben Kacheln ohne Diagramm", () => {
  const html = rendereStatistikAnsicht({ kennzahlen });
  assert.match(html, /class="tiles"/u);
  assert.match(html, /277/u);
  assert.doesNotMatch(html, /id="plot"/u, "ohne Verlauf gibt es kein Diagramm");
  assert.doesNotMatch(html, /data-fenster/u, "und keine Filterzeile für nichts");
});
