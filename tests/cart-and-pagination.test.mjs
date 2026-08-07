import assert from "node:assert/strict";
import test from "node:test";

const { cartButtonState } = await import("../lib/cart.ts");
const {
  DEFAULT_PAGE_SIZE, PAGE_SIZES, clampPage, pageCount, pageNumbers, pageSlice, toPageSize,
} = await import("../lib/pagination.ts");

// --- Warenkorbknopf ---------------------------------------------------------

test("eine freie Karte laesst sich hinzufuegen", () => {
  const state = cartButtonState(1, 0);
  assert.equal(state.action, "add");
  assert.equal(state.disabled, false);
  assert.equal(state.label, "In den Warenkorb");
});

test("eine Karte im Warenkorb laesst sich wieder herausnehmen", () => {
  const state = cartButtonState(1, 1);
  assert.equal(state.action, "remove");
  assert.equal(state.disabled, false, "der Knopf muss klickbar bleiben, sonst ist es eine Sackgasse");
  assert.equal(state.label, "Aus dem Warenkorb");
});

/** Der eigentliche Grund für die Reihenfolge der Prüfungen: Der Import läuft
 *  alle zwei Stunden, eine Karte kann zwischen „hinzugefügt" und „angesehen"
 *  ausverkauft sein. Bliebe sie dann festklemmt, könnte der Kunde seinen
 *  Warenkorb nicht mehr leeren. */
test("eine ausverkaufte Karte im Warenkorb bleibt entfernbar", () => {
  const state = cartButtonState(0, 1);
  assert.equal(state.action, "remove");
  assert.equal(state.disabled, false);
});

test("eine ausverkaufte Karte ohne Warenkorbeintrag ist gesperrt", () => {
  const state = cartButtonState(0, 0);
  assert.equal(state.action, null);
  assert.equal(state.disabled, true);
  assert.equal(state.label, "Nicht verfügbar");
});

test("bei mehreren Stueck bleibt Hinzufuegen moeglich, bis der Bestand erreicht ist", () => {
  assert.equal(cartButtonState(3, 1).action, "add");
  assert.equal(cartButtonState(3, 2).action, "add");
  assert.equal(cartButtonState(3, 3).action, "remove");
});

test("unsinnige Mengen gelten als null, nicht als Freibrief", () => {
  for (const kaputt of [NaN, -1, 1.5, Infinity]) {
    assert.equal(cartButtonState(kaputt, 0).disabled, true, `Bestand ${kaputt}`);
  }
  // Ein kaputter Warenkorbwert darf nicht als "liegt drin" durchgehen.
  assert.equal(cartButtonState(1, NaN).action, "add");
});

// --- Seitengroesse ----------------------------------------------------------

test("nur die angebotenen Seitengroessen werden uebernommen", () => {
  for (const size of PAGE_SIZES) assert.equal(toPageSize(String(size)), size);
});

test("alles andere faellt auf die Vorgabe zurueck", () => {
  for (const kaputt of ["99999", "0", "-10", "abc", null, undefined, ""]) {
    assert.equal(toPageSize(kaputt), DEFAULT_PAGE_SIZE, `Eingabe ${JSON.stringify(kaputt)}`);
  }
});

// --- Blaettern --------------------------------------------------------------

test("die Seitenzahl passt zum Bestand", () => {
  assert.equal(pageCount(294, 20), 15);
  assert.equal(pageCount(294, 100), 3);
  assert.equal(pageCount(300, 100), 3, "eine glatt aufgehende Zahl erzeugt keine leere Seite");
  assert.equal(pageCount(0, 20), 1, "bei null Treffern gibt es Seite 1 von 1, nicht von 0");
});

test("der Ausschnitt stimmt und zaehlt ab eins", () => {
  const karten = Array.from({ length: 294 }, (_, index) => index);
  const zweite = pageSlice(karten, 2, 20);
  assert.equal(zweite.items.length, 20);
  assert.equal(zweite.items[0], 20);
  assert.equal(zweite.first, 21);
  assert.equal(zweite.last, 40);
  assert.equal(zweite.pages, 15);
});

test("die letzte Seite darf unvollstaendig sein", () => {
  const karten = Array.from({ length: 294 }, (_, index) => index);
  const letzte = pageSlice(karten, 15, 20);
  assert.equal(letzte.items.length, 14);
  assert.equal(letzte.first, 281);
  assert.equal(letzte.last, 294);
});

test("null Treffer melden 0 von 0, nicht 1 von 0", () => {
  const leer = pageSlice([], 1, 20);
  assert.equal(leer.items.length, 0);
  assert.equal(leer.first, 0);
  assert.equal(leer.last, 0);
  assert.equal(leer.pages, 1);
});

/** Der Fall, der ohne Klemmung eine leere Ansicht erzeugt: Wer auf Seite 12
 *  steht und dann sucht, hat plötzlich nur noch drei Treffer. */
test("eine zu hohe Seite rutscht auf die letzte gueltige", () => {
  const karten = Array.from({ length: 3 }, (_, index) => index);
  const angezeigt = pageSlice(karten, 12, 20);
  assert.equal(angezeigt.page, 1);
  assert.equal(angezeigt.items.length, 3);
  assert.equal(clampPage(12, 3, 20), 1);
  assert.equal(clampPage(99, 294, 20), 15);
});

test("Seitenzahlen unter eins und Unsinn landen auf Seite 1", () => {
  for (const kaputt of [0, -5, NaN, "abc", null, undefined]) {
    assert.equal(clampPage(kaputt, 294, 20), 1, `Eingabe ${JSON.stringify(kaputt)}`);
  }
});

test("die Blaetterleiste zeigt Anfang, Ende und die Umgebung", () => {
  assert.deepEqual(pageNumbers(8, 15), [1, null, 6, 7, 8, 9, 10, null, 15]);
  assert.deepEqual(pageNumbers(14, 15), [1, null, 12, 13, 14, 15]);
  assert.deepEqual(pageNumbers(1, 15), [1, 2, 3, null, 15]);
});

test("wenige Seiten stehen vollstaendig da, ohne Auslassung", () => {
  assert.deepEqual(pageNumbers(1, 1), [1]);
  assert.deepEqual(pageNumbers(2, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(pageNumbers(4, 6), [1, 2, 3, 4, 5, 6]);
});

/** Ein „…" für eine einzige verdeckte Zahl kostet mehr Platz, als es spart —
 *  deshalb wird eine Lücke von genau eins ausgeschrieben. Bei fünf Seiten und
 *  Seite 1 ist das die Seite 4. */
test("eine Luecke von genau einer Seite wird ausgeschrieben", () => {
  const leiste = pageNumbers(1, 5);
  assert.deepEqual(leiste, [1, 2, 3, 4, 5]);
  assert.ok(!leiste.includes(null));
});

/** Die Leiste darf nicht mit dem Bestand wachsen — sonst stehen bei 30 Seiten
 *  (294 Karten zu je 10) dreißig Schaltflächen nebeneinander. */
test("die Leiste bleibt auch bei vielen Seiten kurz", () => {
  for (const seite of [1, 2, 15, 29, 30]) {
    assert.ok(pageNumbers(seite, 30).length <= 9, `Seite ${seite} von 30`);
  }
});

test("die aktuelle Seite steht immer in der Leiste", () => {
  for (let seite = 1; seite <= 15; seite += 1) {
    assert.ok(pageNumbers(seite, 15).includes(seite), `Seite ${seite}`);
  }
});
