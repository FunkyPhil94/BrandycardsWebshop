import assert from "node:assert/strict";
import test from "node:test";

const { baueTagesreihe, verdichteAufTage } = await import("../lib/assistant/statistics-series.ts");
const { fensterAuswahl, kuerzeAufWortgrenze, rendereStatistikBilder } = await import("../lib/assistant/statistics-visual.ts");

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
  // Die **vollstaendige** Tagesreihe -- `sales` ist auf `limit` gekuerzt und
  // taugt nicht als Grundlage fuer ein Diagramm.
  dailySeries: [
    { day: "2026-08-11", shopCents: 0, ebayCents: 0, shopItems: 0, ebayItems: 0 },
    { day: "2026-08-12", shopCents: 500, ebayCents: 0, shopItems: 1, ebayItems: 0 },
    { day: "2026-08-13", shopCents: 0, ebayCents: 0, shopItems: 0, ebayItems: 0 },
    { day: "2026-08-14", shopCents: 0, ebayCents: 0, shopItems: 0, ebayItems: 0 },
    { day: "2026-08-15", shopCents: 0, ebayCents: 2500, shopItems: 0, ebayItems: 2 },
    { day: "2026-08-16", shopCents: 0, ebayCents: 0, shopItems: 0, ebayItems: 0 },
    { day: "2026-08-17", shopCents: 0, ebayCents: 0, shopItems: 0, ebayItems: 0 },
  ],
  ohneDatum: 0,
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
  const { ohneDatum } = verdichteAufTage([
    { channel: "EBAY", quantity: 1, amountCents: 900, soldAt: null },
    { channel: "EBAY", quantity: 1, amountCents: 900, soldAt: "kein Datum" },
    { channel: "SHOP", quantity: 1, amountCents: 500, soldAt: "2026-08-12T10:00:00.000Z" },
  ], "2026-08-11T00:00:00.000Z", JETZT);
  assert.equal(ohneDatum, 2);
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
  const { dailySeries } = verdichteAufTage([
    { channel: "EBAY", quantity: null, amountCents: null, soldAt: "2026-08-13T10:00:00.000Z" },
  ], "2026-08-11T00:00:00.000Z", JETZT);
  const tag = dailySeries.find((t) => t.day === "2026-08-13");
  assert.equal(tag.ebayItems, 1, "eine Karte ist die sichere Annahme");
  assert.equal(tag.ebayCents, 0, "ein Betrag wird nicht erfunden");
});

test("die Verdichtung ist lückenlos und läuft über ALLE Verkäufe", () => {
  // **Der Fehler, den das behebt:** Das Diagramm baute auf `sales`, und die
  // Liste ist auf `limit` gekuerzt -- hoechstens zwanzig Eintraege, waehrend die
  // Leitzahl darueber alle meint. Die Saeulen waeren stillschweigend zu niedrig
  // gewesen.
  const viele = Array.from({ length: 50 }, () => ({
    channel: "EBAY", quantity: 1, amountCents: 100, soldAt: "2026-08-14T10:00:00.000Z",
  }));
  const { dailySeries } = verdichteAufTage(viele, "2026-08-11T00:00:00.000Z", JETZT);
  assert.equal(dailySeries.length, 7, "11.08. bis 17.08., auch die leeren Tage");
  assert.equal(dailySeries.find((t) => t.day === "2026-08-14").ebayCents, 5000, "alle 50, nicht die ersten 20");
});


test("ohne Daten entsteht kein Bild", () => {
  assert.deepEqual(rendereStatistikBilder({}), []);
});

test("es entsteht ein Bild je Ansicht, und jedes ist ein vollständiges SVG", () => {
  const bilder = rendereStatistikBilder({ verkauf: verkauf(), kennzahlen });
  // Sieben Tage abgefragt -> nur das 7-Tage-Fenster ist gedeckt, mal zwei Kennzahlen.
  assert.deepEqual(bilder.map((b) => b.schluessel), ["7-umsatz", "7-stueck"]);
  for (const bild of bilder) {
    assert.match(bild.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/u);
    assert.match(bild.svg, /<\/svg>$/u);
    assert.match(bild.svg, /viewBox="0 0 520 \d+"/u);
    assert.ok(bild.titel.length > 0 && bild.hinweis.length > 0);
  }
});

test("die Texte stehen als Felder, nicht im Bild", () => {
  // **Der Befund vom 2026-08-17:** Direct2D zeichnet kein <text> und
  // ueberspringt es stillschweigend -- im Assistenten kamen die Bilder ohne
  // eine einzige Beschriftung an. Seitdem liefert der Server fertige
  // Zeichenketten, und WinUI setzt sie nativ.
  const [bild] = rendereStatistikBilder({ verkauf: verkauf(), kennzahlen });
  assert.match(bild.heroLabel, /Umsatz, letzte \d+ Tage/u);
  assert.match(bild.heroWert, /€/u);
  assert.equal(bild.kacheln.length, 5);
  assert.equal(bild.kacheln[0].label, "Verkaufsfähige Karten");
  assert.equal(bild.kacheln[0].wert, "277");
  assert.deepEqual(bild.legende.map((l) => l.name), ["Shop", "eBay"]);
  assert.equal(bild.achse.length, 5, "vier Teilungen ergeben fuenf Werte");
  assert.match(bild.zeitraum, /\d{2}\.\d{2}\. – \d{2}\.\d{2}\./u);
  // Und im Bild selbst steht garantiert kein Text.
  assert.doesNotMatch(bild.svg, /<text/u);
});

test("kein style-Block, keine CSS-Variablen, keine Media-Query", () => {
  // Was SvgImageSource davon versteht, ist ungewiss -- darauf zu bauen hiesse
  // raten. Farben stehen als Attribute an den Formen.
  for (const bild of rendereStatistikBilder({ verkauf: verkauf(), kennzahlen })) {
    assert.doesNotMatch(bild.svg, /<style|var\(--|@media|prefers-color-scheme/u);
    assert.match(bild.svg, /fill="#[0-9a-fA-F]{6}"/u);
  }
});

test("das Thema entscheidet der Server, mit eigenen Stufen je Fläche", () => {
  const [hell] = rendereStatistikBilder({ verkauf: verkauf() }, "hell");
  const [dunkel] = rendereStatistikBilder({ verkauf: verkauf() }, "dunkel");
  // Gemessene Slots: hell #2a78d6/#eb6834, dunkel #3987e5/#d95926.
  assert.match(hell.svg, /#2a78d6/u);
  assert.match(hell.svg, /#eb6834/u);
  assert.match(dunkel.svg, /#3987e5/u);
  assert.match(dunkel.svg, /#d95926/u);
  // Kein automatischer Umschlag: die dunklen Stufen sind andere Hexwerte.
  assert.doesNotMatch(dunkel.svg, /#2a78d6/u);
});

test("eine Metrik je Bild — niemals zwei y-Achsen", () => {
  const bilder = rendereStatistikBilder({ verkauf: verkauf() });
  assert.deepEqual(bilder.map((b) => b.metrik), ["umsatz", "stueck"]);
  assert.match(bilder[0].hinweis, /Bruttoumsatz/u);
  assert.match(bilder[1].hinweis, /verkaufte Karten/u);
});

test("Legende und Spitzenwert sind Pflicht — das Orange liegt hell unter 3:1", () => {
  // Der Validator meldete 2,76:1. Das verpflichtet zu sichtbaren Labels; sie
  // stehen jetzt als Text daneben statt im Bild.
  const [bild] = rendereStatistikBilder({ verkauf: verkauf() }, "hell");
  assert.deepEqual(bild.legende, [{ name: "Shop", farbe: "#2a78d6" }, { name: "eBay", farbe: "#eb6834" }]);
  assert.match(bild.spitze, /Höchster Wert/u);
});

test("Gitterlinien sind durchgezogene Haarlinien", () => {
  const [bild] = rendereStatistikBilder({ verkauf: verkauf() });
  assert.doesNotMatch(bild.svg, /stroke-dasharray/u);
  assert.match(bild.svg, /stroke-width="1"/u);
});

test("Text trägt Textfarben, nie die Serienfarbe", () => {
  const [bild] = rendereStatistikBilder({ verkauf: verkauf() }, "hell");
  assert.doesNotMatch(bild.svg, /<text[^>]*fill="#2a78d6"/u);
  assert.doesNotMatch(bild.svg, /<text[^>]*fill="#eb6834"/u);
});

test("das Bild enthält nur Formen, also nichts zu maskieren", () => {
  // Fremdtext erreicht das SVG gar nicht mehr -- er wandert in Felder, die als
  // JSON uebertragen und von WinUI als Text gesetzt werden.
  const [bild] = rendereStatistikBilder({ verkauf: verkauf({ revenueBasis: "</text><script>alert(1)</script>" }) });
  assert.doesNotMatch(bild.svg, /script|<text/u);
  assert.match(bild.svg, /^<svg /u);
});

test("gekürzt wird an der Wortgrenze, nicht mitten im Wort", () => {
  assert.equal(kuerzeAufWortgrenze("Kurz", 20), "Kurz");
  assert.equal(kuerzeAufWortgrenze("Bruttoumsatz vor Gebühren und mehr", 20), "Bruttoumsatz vor …");
  // Ein einzelnes ueberlanges Wort wird hart geschnitten -- sonst bliebe nichts.
  assert.equal(kuerzeAufWortgrenze("A".repeat(40), 10), "AAAAAAAAAA …");
});

test("Kennzahlen allein ergeben eine Ansicht ohne Diagramm", () => {
  const bilder = rendereStatistikBilder({ kennzahlen });
  assert.equal(bilder.length, 1);
  assert.equal(bilder[0].schluessel, "kennzahlen");
  assert.equal(bilder[0].heroLabel, "Shop-Kennzahlen");
  assert.equal(bilder[0].svg, "", "ohne Verkaufsdaten gibt es kein Diagramm");
  assert.equal(bilder[0].kacheln.length, 5);
});

test("das erfragte Fenster ist immer dabei", () => {
  // Wer „die letzten 45 Tage" fragt, soll seine 45 Tage sehen -- sonst waere der
  // Zeitraum in Wahrheit fest, egal was gefragt wurde.
  assert.deepEqual(fensterAuswahl(45, 45), [7, 30, 45]);
  assert.deepEqual(fensterAuswahl(30, 90), [7, 30, 90], "ein Standardfenster verdoppelt sich nicht");
  // Angeboten wird nur, wofuer Tage vorliegen: Ein Knopf ueber leeren Wochen
  // behauptete, es sei nichts verkauft worden.
  assert.deepEqual(fensterAuswahl(90, 7), [7]);
  assert.deepEqual(fensterAuswahl(3, 10), [3, 7]);
});

test("ein erfragtes Zwischenfenster erscheint als eigene Ansicht", () => {
  const tage = Array.from({ length: 45 }, (_, index) => ({
    day: new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10),
    shopCents: 0, ebayCents: 100, shopItems: 0, ebayItems: 1,
  }));
  const bilder = rendereStatistikBilder({ verkauf: verkauf({ days: 45, dailySeries: tage }) });
  assert.deepEqual(bilder.map((b) => b.schluessel), ["7-umsatz", "7-stueck", "30-umsatz", "30-stueck", "45-umsatz", "45-stueck"]);
  assert.match(bilder.find((b) => b.schluessel === "45-umsatz").titel, /45 Tage/u);
});

test("die Leitzahl gehört zum gezeigten Fenster, nicht zur gestellten Frage", () => {
  // Sonst stuende ueber einem 7-Tage-Diagramm der 90-Tage-Umsatz, und beide
  // Zahlen im selben Bild widersprechen sich.
  const tage = Array.from({ length: 45 }, (_, index) => ({
    day: new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10),
    shopCents: 0, ebayCents: 100, shopItems: 0, ebayItems: 1,
  }));
  const bilder = rendereStatistikBilder({ verkauf: verkauf({ days: 45, dailySeries: tage, totalRevenueCents: 4500 }) });
  const sieben = bilder.find((b) => b.schluessel === "7-umsatz");
  const fuenfundvierzig = bilder.find((b) => b.schluessel === "45-umsatz");
  assert.equal(sieben.heroLabel, "Umsatz, letzte 7 Tage");
  assert.equal(sieben.heroWert, "7,00 €");
  assert.equal(fuenfundvierzig.heroLabel, "Umsatz, letzte 45 Tage");
  assert.equal(fuenfundvierzig.heroWert, "45,00 €");
});
