import assert from "node:assert/strict";
import test from "node:test";

const { baueTagesreihe } = await import("../lib/assistant/statistics-series.ts");
const { kuerzeAufWortgrenze, rendereStatistikBilder } = await import("../lib/assistant/statistics-visual.ts");

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

test("das Bild trägt alles — auch Leitzahl und Kacheln", () => {
  // Wuerde WinUI die Zahlen als eigene Elemente setzen, formatierte der Client
  // wieder Daten. Genau das hat Phase 4 entfernt.
  const [bild] = rendereStatistikBilder({ verkauf: verkauf(), kennzahlen });
  assert.match(bild.svg, /30,00 €/u, "die Leitzahl steht im Bild");
  assert.match(bild.svg, /Verkaufsfähige Karten/u);
  assert.match(bild.svg, /277/u);
  assert.match(bild.svg, /Verkäufe im Zeitverlauf/u);
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

test("Legende und Spitzenlabel sind Pflicht — das Orange liegt hell unter 3:1", () => {
  // Der Validator meldete 2,76:1. Das verpflichtet zu sichtbaren Labels.
  const [bild] = rendereStatistikBilder({ verkauf: verkauf() }, "hell");
  assert.match(bild.svg, />Shop</u);
  assert.match(bild.svg, />eBay</u);
  // Genau ein direktes Label am Spitzenwert, nicht auf jeder Saeule.
  assert.equal((bild.svg.match(/font-weight="600" text-anchor="middle"/gu) ?? []).length, 1);
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

test("Fremdtext wird maskiert und kann das Bild nicht verlassen", () => {
  const [bild] = rendereStatistikBilder({ verkauf: verkauf({ revenueBasis: '</text><script>alert(1)</script>' }) });
  assert.doesNotMatch(bild.svg, /<script>alert/u);
  assert.match(bild.svg, /&lt;script&gt;/u);
});

test("gekürzt wird an der Wortgrenze, nicht mitten im Wort", () => {
  assert.equal(kuerzeAufWortgrenze("Kurz", 20), "Kurz");
  assert.equal(kuerzeAufWortgrenze("Bruttoumsatz vor Gebühren und mehr", 20), "Bruttoumsatz vor …");
  // Ein einzelnes ueberlanges Wort wird hart geschnitten -- sonst bliebe nichts.
  assert.equal(kuerzeAufWortgrenze("A".repeat(40), 10), "AAAAAAAAAA …");
});

test("Kennzahlen allein ergeben ein Bild ohne Diagramm", () => {
  const bilder = rendereStatistikBilder({ kennzahlen });
  assert.equal(bilder.length, 1);
  assert.equal(bilder[0].schluessel, "kennzahlen");
  assert.match(bilder[0].svg, /Shop-Kennzahlen/u);
  assert.doesNotMatch(bilder[0].svg, /Verkäufe im Zeitverlauf/u);
});

test("ein größeres Fenster liefert mehr Ansichten", () => {
  const daten = verkauf({ days: 90, since: "2026-05-19T00:00:00.000Z" });
  const bilder = rendereStatistikBilder(daten.days ? { verkauf: daten } : {});
  assert.deepEqual(bilder.map((b) => b.schluessel), ["7-umsatz", "7-stueck", "30-umsatz", "30-stueck", "90-umsatz", "90-stueck"]);
  // Bei 90 Tagen wird auf Wochen verdichtet, bei 7 und 30 nicht.
  assert.match(bilder.find((b) => b.schluessel === "90-umsatz").hinweis, /Wochen/u);
  assert.match(bilder.find((b) => b.schluessel === "30-umsatz").hinweis, /Tage/u);
});
