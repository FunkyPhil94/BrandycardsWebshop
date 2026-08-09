import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const { verfuegbareMenge, istImKatalogSichtbar, istKaufbar, istKaufbareKategorie, KAUFBARE_KATEGORIEN } = await import("../lib/catalog-availability.ts");

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

// --- Was in den Warenkorb darf ---------------------------------------------
//
// Am 2026-08-09 beim Durchstich mit der ersten von Hand eingestellten Karte
// gefunden, nicht von einem Test: Der Checkout filterte auf
// `category === "Festpreis"`. Die Karte liess sich hinzufuegen, der Warenkorb
// meldete danach „leer". Kein Fehler, keine Meldung — sie war einfach weg.

test("eine von Hand eingestellte Karte ist kaufbar", () => {
  assert.equal(istKaufbareKategorie("Direkt bei uns"), true,
    "genau dieser Fall liess den Warenkorb leer aussehen");
});

test("eine eBay-Karte bleibt kaufbar", () => {
  assert.equal(istKaufbareKategorie("Festpreis"), true);
});

test("die Vormerkliste ist nicht kaufbar", () => {
  // Sie ist eine Ankuendigung: quantity steht fest auf 0, die Aktion heisst
  // „Vormerken". Genau dafuer gab es den Filter im Checkout ueberhaupt.
  assert.equal(istKaufbareKategorie("Vormerkliste"), false);
});

test("Unbekanntes gilt als nicht kaufbar", () => {
  // Allowlist, keine Blockliste: Eine kuenftige Kategorie ist erst einmal
  // draussen. Eine Karte zu wenig im Warenkorb ist ein Anruf, eine zu viel ist
  // ein Verkauf, den es nicht gibt.
  for (const wert of ["Auktion", "", "festpreis", null, undefined, 0, {}]) {
    assert.equal(istKaufbareKategorie(wert), false, `durchgelassen: ${JSON.stringify(wert)}`);
  }
});

test("der Checkout benutzt die Funktion und nicht wieder eine Zeichenkette", async () => {
  // Der eigentliche Schutz. Die Entscheidung ist an dieser Stelle viermal
  // falsch getroffen worden (Bestellroute, Preisvorschlag, Detailseite,
  // Checkout); ein Test auf die Funktion allein haette den Rueckfall auf einen
  // Vergleich im Checkout nicht bemerkt.
  const quelle = await readFile(new URL("../app/checkout/page.tsx", import.meta.url), "utf8");
  assert.match(quelle, /istKaufbareKategorie\(product\.category\)/,
    "der Checkout muss die geteilte Entscheidung benutzen");
  assert.ok(!/category === "Festpreis"/.test(quelle),
    "genau dieser Vergleich hat die manuelle Karte aus dem Warenkorb geworfen");
});

test("jede kaufbare Kategorie kommt auch wirklich aus der Katalogroute", async () => {
  // Sonst schuetzt die Allowlist vor nichts: Eine Kategorie, die hier steht,
  // die Route aber nie ausliefert, ist tot — und eine, die die Route
  // ausliefert und die hier fehlt, verschwindet still aus dem Warenkorb.
  const quelle = await readFile(new URL("../app/api/products/route.ts", import.meta.url), "utf8");
  for (const kategorie of KAUFBARE_KATEGORIEN) {
    assert.ok(quelle.includes(`"${kategorie}"`), `die Katalogroute kennt "${kategorie}" nicht`);
  }
});

// --- F-10: die Adminkachel zaehlt Verkaufbares, nicht "aktive Zeilen" -------
//
// Nach dem Verkauf bleibt eine manuelle Karte auf products.status = 'ACTIVE'
// stehen: Bei eBay-Karten raeumt der Sync das auf, fuer manuelle gibt es den
// Weg nicht. Die Kachel zaehlte die Zeile weiter und driftete mit jedem
// Vorverkauf um eins von den aktiven eBay-Angeboten weg.

test("eine verkaufte manuelle Karte zaehlt nicht mehr mit", () => {
  assert.equal(istKaufbar("PRELISTED", null, null, { availableQuantity: 0, status: "SOLD" }, "MANUAL"), false,
    "genau dieser Fall liess die Zahl davonlaufen");
});

test("eine manuelle Karte mit Bestand zaehlt mit", () => {
  assert.equal(istKaufbar("PRELISTED", null, null, { availableQuantity: 1, status: "AVAILABLE" }, "MANUAL"), true);
});

test("die Vormerkliste ist sichtbar, aber nicht kaufbar", () => {
  // Der eigentliche Unterschied zwischen den beiden Funktionen. Sie steht im
  // Katalog als Ankuendigung, mit der Aktion "Vormerken" - kaufen kann man sie
  // nicht, also gehoert sie nicht in eine Zahl ueber Verkaufbares.
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, null), true);
  assert.equal(istKaufbar("PRELISTED", null, null, null), false);
});

test("eine eBay-Karte mit Bestand zaehlt, eine ausverkaufte nicht", () => {
  assert.equal(istKaufbar("EBAY_SYNCED", "FIXED_PRICE", 1, { availableQuantity: 1, status: "AVAILABLE" }), true);
  assert.equal(istKaufbar("EBAY_SYNCED", "FIXED_PRICE", 1, { availableQuantity: 0, status: "SOLD" }), false);
  assert.equal(istKaufbar("EBAY_SYNCED", "AUCTION", 1, { availableQuantity: 1, status: "AVAILABLE" }), false,
    "Auktionen gehoeren nicht in den Shop und damit auch nicht in die Zahl");
});

test("die Adminkachel benutzt die geteilte Entscheidung, nicht eigenes SQL", async () => {
  // Eine zweite Fassung in SQL waere die fuenfte Stelle, an der dieselbe Frage
  // beantwortet wird - und die vier bisherigen sind alle auseinandergelaufen.
  const route = await readFile(new URL("../app/api/admin/dashboard/route.ts", import.meta.url), "utf8");
  assert.match(route, /istKaufbar\(/u, "die Kachel muss dieselbe Regel benutzen wie der Katalog");
  assert.ok(!/count\(\)\s*\}\)\.from\(products\)/u.test(route),
    "ein reiner Zaehler auf products zaehlt auch, was niemand kaufen kann");
});
