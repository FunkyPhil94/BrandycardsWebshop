import assert from "node:assert/strict";
import test from "node:test";

// Der Vergleich, der den Sync billig macht (docs/ai-todo.md, Punkt 2). Ein Lauf
// schrieb bisher ~5 396 Zeilen, obwohl sich zwischen zwei Läufen fast nie etwas
// ändert — die Läufe der letzten 24 Stunden meldeten durchgehend „294
// aktualisiert, 0 importiert, 0 deaktiviert".
//
// Zwei Richtungen sind zu prüfen, und die zweite ist die wichtigere:
// **Unverändertes darf nicht geschrieben werden** — und **Geändertes muss
// geschrieben werden.** Ein Vergleich, der zu viel überspringt, lässt den Shop
// mit veralteten Preisen und verkauften Karten dastehen. Deshalb steht hier zu
// jedem Feld, das der Sync schreibt, ein eigener Fall.

const { stehtSchonSo, bilderStehenSchonSo } = await import("../lib/ebay-sync-diff.ts");

/** Ein Listing, wie es nach einem Lauf in der Datenbank steht. */
function gespeichertesListing() {
  return {
    id: "listing-1",
    productId: "produkt-1",
    ebayItemId: "123456789012",
    ebayOfferId: null,
    sku: null,
    title: "Panini Prizm Bellingham",
    descriptionHtml: "<p>vom ersten Öffnen zwischengespeichert</p>",
    priceAmountCents: 4500,
    priceCurrency: "EUR",
    quantity: 1,
    listingType: "FIXED_PRICE",
    listingUrl: "https://www.ebay.de/itm/123456789012",
    startAt: "2026-08-06T17:13:00.000Z",
    endAt: null,
    rawData: { source: "trading-api", marketplaceId: "EBAY_DE", itemId: "123456789012" },
    status: "ACTIVE",
    lastSyncedAt: "2026-08-08T04:00:46.000Z",
    updatedAt: "2026-08-08T04:00:46.000Z",
  };
}

/** Was der Sync für dasselbe, unveränderte Listing schreiben würde.
 *
 * `descriptionHtml: undefined` ist kein Versehen, sondern genau der Fall aus
 * `lib/ebay-sync.ts`: `GetMyeBaySelling` liefert keine Beschreibung.
 */
function gewuenschteWerte(abweichung = {}) {
  return {
    productId: "produkt-1",
    ebayItemId: "123456789012",
    ebayOfferId: null,
    sku: undefined,
    title: "Panini Prizm Bellingham",
    descriptionHtml: undefined,
    priceAmountCents: 4500,
    priceCurrency: "EUR",
    quantity: 1,
    listingType: "FIXED_PRICE",
    listingUrl: "https://www.ebay.de/itm/123456789012",
    startAt: "2026-08-06T17:13:00.000Z",
    endAt: null,
    rawData: { source: "trading-api", marketplaceId: "EBAY_DE", itemId: "123456789012" },
    status: "ACTIVE",
    // Diese beiden tragen die Uhrzeit dieses Laufs und sind damit bei jedem
    // Lauf anders. Sie dürfen nichts auslösen — sonst wäre der ganze Vergleich
    // wirkungslos, und das ist der Fehler, den dieser Test verhindert.
    lastSyncedAt: "2026-08-08T06:00:38.000Z",
    updatedAt: "2026-08-08T06:00:38.000Z",
    ...abweichung,
  };
}

// --- Nichts geändert: nichts schreiben --------------------------------------

test("ein unverändertes Listing löst keinen Schreibvorgang aus", () => {
  assert.equal(stehtSchonSo(gespeichertesListing(), gewuenschteWerte()), true);
});

test("frische Zeitstempel allein sind kein Grund zu schreiben", () => {
  // Der Kern der Ersparnis. Ohne diese Ausnahme gälte jedes Listing bei jedem
  // Lauf als geändert.
  const werte = gewuenschteWerte({ lastSyncedAt: "2027-01-01T00:00:00.000Z", updatedAt: "2027-01-01T00:00:00.000Z" });
  assert.equal(stehtSchonSo(gespeichertesListing(), werte), true);
});

test("die zwischengespeicherte Beschreibung wird nicht angefasst", () => {
  // `descriptionHtml` ist `undefined`, weil der Import keine Beschreibung
  // kennt. Drizzle lässt das Feld beim UPDATE weg; der Vergleich muss dieselbe
  // Auslassung abbilden. Täte er es nicht, sähe er einen Unterschied zum
  // gespeicherten Text — und der Schreibvorgang danach überschriebe den
  // Zwischenspeicher aus app/api/products/[id]/route.ts mit NULL.
  assert.equal(stehtSchonSo(gespeichertesListing(), gewuenschteWerte()), true);
  assert.equal(gewuenschteWerte().descriptionHtml, undefined, "der Fall muss echt sein, nicht versehentlich weggelassen");
});

test("gleiches rawData mit gleichem Inhalt zählt als unverändert", () => {
  const werte = gewuenschteWerte({ rawData: { source: "trading-api", marketplaceId: "EBAY_DE", itemId: "123456789012" } });
  assert.equal(stehtSchonSo(gespeichertesListing(), werte), true);
});

// --- Etwas geändert: schreiben ----------------------------------------------

test("ein geänderter Preis wird geschrieben", () => {
  assert.equal(stehtSchonSo(gespeichertesListing(), gewuenschteWerte({ priceAmountCents: 3900 })), false);
});

test("eine geänderte Menge wird geschrieben", () => {
  // Der Fall, an dem am meisten hängt: Menge 0 heißt verkauft, und daraus
  // folgen ENDED, INACTIVE und UNAVAILABLE. Würde er übersprungen, bliebe eine
  // verkaufte Karte im Shop kaufbar.
  assert.equal(stehtSchonSo(gespeichertesListing(), gewuenschteWerte({ quantity: 0 })), false);
});

test("ein geänderter Status wird geschrieben", () => {
  assert.equal(stehtSchonSo(gespeichertesListing(), gewuenschteWerte({ status: "ENDED" })), false);
});

test("ein geänderter Titel wird geschrieben", () => {
  assert.equal(stehtSchonSo(gespeichertesListing(), gewuenschteWerte({ title: "Panini Prizm Bellingham Silver" })), false);
});

test("ein neu gefülltes Feld wird geschrieben, ein geleertes ebenso", () => {
  assert.equal(stehtSchonSo(gespeichertesListing(), gewuenschteWerte({ endAt: "2026-09-01T12:00:00.000Z" })), false);
  assert.equal(stehtSchonSo(gespeichertesListing(), gewuenschteWerte({ startAt: null })), false);
});

test("verändertes rawData wird geschrieben", () => {
  const werte = gewuenschteWerte({ rawData: { source: "trading-api", marketplaceId: "EBAY_US", itemId: "123456789012" } });
  assert.equal(stehtSchonSo(gespeichertesListing(), werte), false);
});

test("ohne gespeicherte Zeile wird immer geschrieben", () => {
  assert.equal(stehtSchonSo(undefined, gewuenschteWerte()), false);
  assert.equal(stehtSchonSo(null, gewuenschteWerte()), false);
});

test("eine fehlende Spalte gilt als Unterschied, nicht als Übereinstimmung", () => {
  // Im Zweifel schreiben. Wer den Vergleich später um ein Feld erweitert und
  // vergisst, es mitzulesen, bekommt einen überflüssigen Schreibvorgang — nicht
  // einen stillen Datenverlust.
  const ohneStatus = gespeichertesListing();
  delete ohneStatus.status;
  assert.equal(stehtSchonSo(ohneStatus, gewuenschteWerte()), false);
});

// --- Produkt und Bestand -----------------------------------------------------

test("Produkt und Bestand werden nach denselben Regeln verglichen", () => {
  const produkt = { id: "produkt-1", title: "Panini Prizm Bellingham", description: null, status: "ACTIVE" };
  assert.equal(stehtSchonSo(produkt, { title: "Panini Prizm Bellingham", description: null, status: "ACTIVE", updatedAt: "2026-08-08T06:00:38.000Z" }), true);
  assert.equal(stehtSchonSo(produkt, { title: "Panini Prizm Bellingham", description: null, status: "INACTIVE", updatedAt: "2026-08-08T06:00:38.000Z" }), false);

  const bestand = { id: "bestand-1", productId: "produkt-1", status: "AVAILABLE", availableQuantity: 1 };
  assert.equal(stehtSchonSo(bestand, { status: "AVAILABLE", availableQuantity: 1, updatedAt: "2026-08-08T06:00:38.000Z" }), true);
  assert.equal(stehtSchonSo(bestand, { status: "UNAVAILABLE", availableQuantity: 0, updatedAt: "2026-08-08T06:00:38.000Z" }), false);
});

// --- Bilder ------------------------------------------------------------------

test("gleiche Bilder in gleicher Reihenfolge werden nicht angefasst", () => {
  const bilder = ["https://i.ebayimg.com/a.jpg", "https://i.ebayimg.com/b.jpg"];
  assert.equal(bilderStehenSchonSo(bilder, [...bilder]), true);
});

test("ohne Bilder auf beiden Seiten passiert nichts", () => {
  assert.equal(bilderStehenSchonSo([], []), true);
});

test("ein zusätzliches, ein fehlendes und ein vertauschtes Bild werden erkannt", () => {
  const bilder = ["https://i.ebayimg.com/a.jpg", "https://i.ebayimg.com/b.jpg"];
  assert.equal(bilderStehenSchonSo(bilder, [...bilder, "https://i.ebayimg.com/c.jpg"]), false);
  assert.equal(bilderStehenSchonSo(bilder, [bilder[0]]), false);
  // Die Reihenfolge ist keine Nebensache: Sie wird als `sortOrder` gespeichert
  // und bestimmt, welches Bild die Karte im Katalog zeigt.
  assert.equal(bilderStehenSchonSo(bilder, [bilder[1], bilder[0]]), false);
});

test("ein Bild ohne hinterlegte Quelle gilt nicht als übereinstimmend", () => {
  assert.equal(bilderStehenSchonSo([null], ["https://i.ebayimg.com/a.jpg"]), false);
});
