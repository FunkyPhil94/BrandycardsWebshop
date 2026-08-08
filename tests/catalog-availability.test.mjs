import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const { verfuegbareMenge, istImKatalogSichtbar } = await import("../lib/catalog-availability.ts");

// Am 2026-08-08, direkt nach dem ersten echten Verkauf: Die verkaufte Karte
// stand weiter mit „1 VERFÜGBAR" im Katalog. Grund war, dass Katalog und
// Detailseite die Menge aus dem **eBay-Listing** lasen und `inventory` gar
// nicht abfragten — ein Shop-Verkauf bucht aber nur den Bestand.

test("eine verkaufte Karte bietet nichts mehr an", () => {
  assert.equal(verfuegbareMenge(1, { availableQuantity: 0, status: "SOLD" }), 0);
});

test("der Bestand schlägt das Listing, nicht umgekehrt", () => {
  // Der Kern des Fehlers: Das Listing behauptet weiter 1, weil eBay nichts von
  // dem Verkauf im Shop weiß.
  assert.equal(verfuegbareMenge(1, { availableQuantity: 0, status: "AVAILABLE" }), 0);
});

test("eine reservierte Karte wird nicht doppelt angeboten", () => {
  assert.equal(verfuegbareMenge(1, { availableQuantity: 0, status: "RESERVED" }), 0);
});

test("eine verfügbare Karte bleibt verfügbar", () => {
  assert.equal(verfuegbareMenge(1, { availableQuantity: 1, status: "AVAILABLE" }), 1);
});

test("bei ungleichen Mengen gilt die kleinere", () => {
  assert.equal(verfuegbareMenge(5, { availableQuantity: 2, status: "AVAILABLE" }), 2);
  assert.equal(verfuegbareMenge(1, { availableQuantity: 9, status: "AVAILABLE" }), 1);
});

test("ein beendetes Listing bietet nichts an, auch mit Bestand", () => {
  assert.equal(verfuegbareMenge(0, { availableQuantity: 1, status: "AVAILABLE" }), 0);
});

test("ohne Bestandszeile gilt die Listing-Menge", () => {
  // **Im Zweifel anzeigen.** Würde eine fehlende Zeile als „ausverkauft"
  // gelten, verschwände bei einem halb geschriebenen Import der halbe Katalog.
  // Die Kasse prüft ohnehin (app/api/orders/route.ts).
  assert.equal(verfuegbareMenge(1, null), 1);
  assert.equal(verfuegbareMenge(1, undefined), 1);
});

test("unsinnige Mengen führen nicht zu negativen Beständen", () => {
  for (const menge of [null, undefined, -3, Number.NaN]) {
    assert.equal(verfuegbareMenge(menge, { availableQuantity: 5, status: "AVAILABLE" }), 0, `Listing-Menge ${menge}`);
  }
  assert.equal(verfuegbareMenge(1, { availableQuantity: -2, status: "AVAILABLE" }), 0);
});

// --- Die Ausnahme, die man leicht zerstört ----------------------------------

test("Karten der Vormerkliste bleiben sichtbar, obwohl sie keinen Bestand haben", () => {
  // PRELISTED-Karten haben weder Listing noch Bestand. Ein Filter auf „Menge
  // größer null" hätte sie stillschweigend aus dem Katalog geworfen — sie sind
  // kein Kaufangebot, sondern eine Ankündigung.
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, null), true);
  assert.equal(istImKatalogSichtbar("PRELISTED", null, 0, { availableQuantity: 0, status: "UNAVAILABLE" }), true);
});

test("eine verkaufte eBay-Karte verschwindet aus dem Katalog", () => {
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "FIXED_PRICE", 1, { availableQuantity: 0, status: "SOLD" }), false);
});

test("eine verfügbare eBay-Karte bleibt im Katalog", () => {
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "FIXED_PRICE", 1, { availableQuantity: 1, status: "AVAILABLE" }), true);
});

// --- Die Verzögerung am Rand ------------------------------------------------

test("der Katalog wird höchstens 90 Sekunden lang veraltet ausgeliefert", async () => {
  // Die Daten sind sofort richtig — der Rand liefert sie aber weiter aus.
  // Vorher: 60 + 300 = gut sechs Minuten. Wer diese Zahlen hochsetzt, verlängert
  // damit die Zeit, in der eine verkaufte Karte noch im Schaufenster steht.
  const quelle = await readFile(new URL("../app/api/products/route.ts", import.meta.url), "utf8");
  const regel = quelle.match(/CATALOGUE_CACHE_CONTROL = "([^"]+)"/)?.[1];
  assert.ok(regel, "die Regel muss als Konstante dastehen");
  const maxAge = Number(regel.match(/max-age=(\d+)/)?.[1]);
  const stale = Number(regel.match(/stale-while-revalidate=(\d+)/)?.[1]);
  assert.ok(maxAge + stale <= 90, `veraltete Auslieferung bis zu ${maxAge + stale} s — zu lang für eine verkaufte Karte`);
});

// --- Auktionen gehören nach eBay, nicht in den Shop -------------------------

test("eine Auktion erscheint nicht im Katalog, auch wenn Bestand da ist", () => {
  // Der Grund ist kein Geschmack: Die Menge einer Auktion lässt sich bei eBay
  // nicht zurücknehmen, weil sie Gebote trägt. Stünde sie im Shop, könnte er
  // sie verkaufen, während eBay sie weiter anbietet — ein Doppelverkauf, den
  // danach niemand mehr verhindern kann.
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "AUCTION", 1, { availableQuantity: 1, status: "AVAILABLE" }), false);
});

test("die Vormerkliste bleibt sichtbar, auch ohne Angebotstyp", () => {
  // PRELISTED wird **vor** der Typprüfung durchgelassen. Andernfalls hätte der
  // Auktionsfilter die Vormerkliste mit aus dem Katalog geworfen — dieselbe
  // Falle wie beim letzten Umbau dieser Datei.
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, null), true);
  assert.equal(istImKatalogSichtbar("PRELISTED", "AUCTION", null, null), true);
});
