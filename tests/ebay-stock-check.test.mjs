import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { soldOutMessage, unavailableTitles } = await import("../lib/ebay-stock-check.ts");

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const KARTE = (title, ebayItemId, quantity = 1) => ({ title, ebayItemId, quantity });
const ANTWORT = (quantityAvailable, listingStatus = "Active") => ({ quantityAvailable, listingStatus });

// --- Punkt 3 aus docs/ai-todo.md -------------------------------------------
// Jede Karte ist ein Einzelstück und steht gleichzeitig hier und auf eBay.
// Wird sie dort verkauft, verkauft der Shop sie bis zum nächsten Import
// weiter. Diese Prüfung schließt die Lücke an der Stelle, an der es zählt.

test("eine bei eBay ausverkaufte Karte wird abgelehnt", () => {
  const gone = unavailableTitles([KARTE("Lamine Yamal Finest", "398200679813")], new Map([
    ["398200679813", ANTWORT(0)],
  ]));
  assert.deepEqual(gone, ["Lamine Yamal Finest"]);
});

test("ein beendetes Angebot zählt als weg, auch wenn die Menge noch steht", () => {
  // eBay kann eine Restmenge melden und das Angebot trotzdem beendet haben.
  const gone = unavailableTitles([KARTE("Rio Ngumoha Base RC", "398173913889")], new Map([
    ["398173913889", ANTWORT(1, "Completed")],
  ]));
  assert.deepEqual(gone, ["Rio Ngumoha Base RC"]);
});

test("eine verfügbare Karte geht durch", () => {
  assert.deepEqual(unavailableTitles([KARTE("Griezmann Raywave", "1")], new Map([["1", ANTWORT(1)]])), []);
});

test("zu wenige Stück für die bestellte Menge zählen als weg", () => {
  const gone = unavailableTitles([KARTE("Doppelpack", "1", 2)], new Map([["1", ANTWORT(1)]]));
  assert.deepEqual(gone, ["Doppelpack"]);
});

// --- Die Leitregel: ein eBay-Ausfall darf nichts blockieren -----------------
// Der Shop wegen einer nicht erreichbaren Fremd-API anzuhalten wäre ein
// größerer Schaden als der seltene Doppelverkauf, den die Prüfung verhindert.

test("keine Antwort von eBay lässt den Kauf durch", () => {
  assert.deepEqual(unavailableTitles([KARTE("Unbekannt", "999")], new Map()), [],
    "eine fehlende Antwort heißt unbekannt, nicht ausverkauft");
});

test("eine unbekannte Menge lässt den Kauf durch", () => {
  assert.deepEqual(unavailableTitles([KARTE("Ohne Menge", "1")], new Map([["1", ANTWORT(null)]])), []);
  assert.deepEqual(unavailableTitles([KARTE("Unsinn", "1")], new Map([["1", ANTWORT(Number.NaN)]])), []);
});

test("eine Karte ohne eBay-Bezug wird übersprungen", () => {
  assert.deepEqual(unavailableTitles([KARTE("Vormerkliste", null)], new Map()), []);
});

test("aus mehreren Karten werden nur die wirklich verlorenen gemeldet", () => {
  const gone = unavailableTitles(
    [KARTE("Weg", "1"), KARTE("Da", "2"), KARTE("Unbekannt", "3"), KARTE("Beendet", "4")],
    new Map([["1", ANTWORT(0)], ["2", ANTWORT(1)], ["4", ANTWORT(1, "Ended")]]),
  );
  assert.deepEqual(gone, ["Weg", "Beendet"]);
});

// --- Die Meldung an den Kunden ---------------------------------------------

test("die Meldung nennt die Karte beim Namen", () => {
  // "Ein Artikel ist nicht mehr verfügbar" lässt jemanden mit fünf Karten im
  // Warenkorb ratlos zurück.
  const eine = soldOutMessage(["Lamine Yamal Finest"]);
  assert.match(eine, /Lamine Yamal Finest/);
  assert.match(eine, /Zahlung wurde nicht ausgeführt/);
  assert.match(eine, /Reservierung ist aufgehoben/);

  const mehrere = soldOutMessage(["Karte A", "Karte B"]);
  assert.match(mehrere, /Karte A/);
  assert.match(mehrere, /Karte B/);
  assert.match(mehrere, /^Diese Karten/, "Mehrzahl, wenn es mehrere sind");
});

// --- Verdrahtung ------------------------------------------------------------

test("beide Zahlungsrouten prüfen, und der Capture vor dem PROCESSING-Riegel", async () => {
  const [capture, orders] = await Promise.all([
    read("app/api/paypal/capture/route.ts"),
    read("app/api/paypal/orders/route.ts"),
  ]);

  assert.match(orders, /ebaySoldOutMessage\(db, order\.id\)/,
    "vor dem Gang zu PayPal prüfen, damit der Kunde es früh erfährt");
  assert.match(capture, /ebaySoldOutMessage\(db, order\.id\)/,
    "und unmittelbar vor dem Einzug, das ist die verbindliche Stelle");

  // Nach dem Riegel geprüft, bliebe eine abgelehnte Bestellung in PROCESSING
  // hängen -- aus dem Status käme sie nur von Hand wieder heraus.
  assert.ok(capture.indexOf("ebaySoldOutMessage") < capture.indexOf('status: "PROCESSING"'),
    "die Prüfung muss vor dem PENDING → PROCESSING-Riegel stehen");

  for (const [name, route] of [["capture", capture], ["orders", orders]]) {
    const block = route.slice(route.indexOf("ebaySoldOutMessage"), route.indexOf("ebaySoldOutMessage") + 400);
    assert.match(block, /releaseOrderReservations/, `${name}: eine abgelehnte Bestellung muss den Bestand freigeben`);
  }
});

test("der Wächter gibt bei eigenem Fehler frei statt zu blockieren", async () => {
  const guard = await read("lib/ebay-stock-guard.ts");
  const catchBlock = guard.slice(guard.indexOf("} catch"));
  assert.match(catchBlock, /return null/,
    "ein Fehler in der Prüfung selbst darf den Verkauf nicht anhalten");
});

test("der Import läuft alle zehn Minuten, sonst trägt diese Prüfung die ganze Last", async () => {
  const wrangler = await read("wrangler.toml");
  const cron = wrangler.match(/crons\s*=\s*\[\s*"([^"]+)"/)?.[1];
  assert.equal(cron, "*/10 * * * *",
    "Punkt 1 und Punkt 3 gehören zusammen: der Import verkleinert das Fenster, die Prüfung schließt den Rest");
});
