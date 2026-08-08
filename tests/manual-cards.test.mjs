import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { istImKatalogSichtbar, verfuegbareMenge } = await import("../lib/catalog-availability.ts");

// Von Hand eingestellte Karten (ai-todo Punkt 11). Die Falle steckt im Schema:
// Sie tragen `kind = 'PRELISTED'`, weil die CHECK-Bedingung auf `kind` keinen
// dritten Wert zuließ — und `PRELISTED` heißt sonst „Ankündigung, immer
// sichtbar". Wer die Reihenfolge der Prüfungen umdreht, macht jede verkaufte
// Handkarte unsterblich.

test("eine manuelle Karte ohne Bestandszeile bietet nichts an", () => {
  // Umgekehrt zur eBay-Regel: Dort gilt bei fehlender Bestandszeile die
  // Listing-Menge („im Zweifel anzeigen"). Eine manuelle Karte hat kein
  // Listing — ohne Bestand gibt es schlicht nichts zu verkaufen.
  assert.equal(verfuegbareMenge(null, null, "MANUAL"), 0);
  assert.equal(verfuegbareMenge(5, null, "MANUAL"), 0, "eine Listing-Menge darf hier nicht durchschlagen");
});

test("bei einer manuellen Karte entscheidet allein der Bestand", () => {
  assert.equal(verfuegbareMenge(null, { availableQuantity: 2, status: "AVAILABLE" }, "MANUAL"), 2);
  assert.equal(verfuegbareMenge(null, { availableQuantity: 1, status: "SOLD" }, "MANUAL"), 0);
  assert.equal(verfuegbareMenge(null, { availableQuantity: 1, status: "UNAVAILABLE" }, "MANUAL"), 0);
});

test("eine verkaufte Handkarte verschwindet aus dem Katalog", () => {
  // **Der eigentliche Regressionstest.** Wird `origin` nicht vor `kind`
  // geprüft, greift die PRELISTED-Ausnahme, und diese Zeile liefert `true` —
  // eine verkaufte Karte bliebe mit Kaufknopf im Schaufenster stehen.
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, { availableQuantity: 0, status: "SOLD" }, "MANUAL"), false);
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, { availableQuantity: 1, status: "AVAILABLE" }, "MANUAL"), true);
});

test("die echte Vormerkliste bleibt sichtbar", () => {
  // Gegenprobe: Ohne `origin` ist `PRELISTED` weiterhin die Ankündigung ohne
  // Bestand und ohne Listing.
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, null), true);
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, null, "EBAY"), true);
});

test("eBay-Karten verhalten sich unverändert", () => {
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "FIXED_PRICE", 1, null), true);
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "AUCTION", 1, null), false);
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "FIXED_PRICE", 1, { availableQuantity: 0, status: "SOLD" }), false);
});

test("die Detailseite verknüpft das Listing nicht mehr zwingend", async () => {
  // Mit `innerJoin` lieferte die Detailseite jeder manuellen Karte 404, während
  // der Katalog sie anzeigte — der Kunde klickt auf eine Karte und landet im
  // Nichts. Stand als Falle Nummer 3 in ai-todo Punkt 11.
  const quelle = await readFile(new URL("../app/api/products/[id]/route.ts", import.meta.url), "utf8");
  assert.ok(!/innerJoin\(ebayListings/u.test(quelle), "ebay_listings darf nicht per innerJoin hängen");
  assert.match(quelle, /leftJoin\(ebayListings/u);
  // Die Statusprüfung darf nicht in die where-Bedingung zurückwandern: Dort
  // filtert `listing.status IS NULL` jede manuelle Karte wieder heraus.
  assert.ok(!/where\([^)]*ebayListings\.status/su.test(quelle.slice(0, quelle.indexOf("const row ="))),
    "der Listing-Status gehört hinter die Abfrage, nicht in die where-Bedingung");
});

test("der Waisen-Sweep fasst manuelle Karten nicht an", async () => {
  // `lib/ebay-sync.ts` deaktiviert jedes Produkt mit `kind = 'EBAY_SYNCED'`
  // ohne Listing-Zeile. Manuelle Karten haben nie eine Listing-Zeile — trügen
  // sie dieselbe `kind`, verschwänden sie beim nächsten Lauf binnen Minuten.
  const sync = await readFile(new URL("../lib/ebay-sync.ts", import.meta.url), "utf8");
  assert.match(sync, /EBAY_SYNCED/u, "der Sweep muss weiterhin auf kind = EBAY_SYNCED eingegrenzt sein");
});

test("die Migration begründet, warum kind unverändert bleibt", async () => {
  // Ohne diese Begründung liest die nächste Sitzung `kind = 'PRELISTED'` bei
  // einer käuflichen Karte als Fehler und „repariert" ihn.
  const migration = await readFile(new URL("../drizzle/0006_manual_cards_and_oauth_claims.sql", import.meta.url), "utf8");
  assert.match(migration, /ON DELETE CASCADE/u);
  assert.match(migration, /PRAGMA foreign_keys = OFF. greift in D1 nicht/u);
});
