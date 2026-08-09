import assert from "node:assert/strict";
import test from "node:test";

const { pickAcceptedPrices, pickAcceptedOffers, offerExpiry, OFFER_VALIDITY_HOURS, MAX_OFFERS_PER_PRODUCT } =
  await import("../lib/price-offers.ts");
const { effectiveUnitPrice } = await import("../lib/offer-price.ts");

// This is the code path that decides what a customer actually pays. The
// checkout takes product ids from the browser and nothing else, so every guard
// here is load-bearing.

const NOW = "2026-08-06T12:00:00.000Z";
const LATER = "2026-08-08T12:00:00.000Z";
const EARLIER = "2026-08-05T12:00:00.000Z";

test("a valid accepted offer sets the price", () => {
  const prices = pickAcceptedPrices([{ productId: "a", amount: 2500, expiresAt: LATER }], NOW);
  assert.equal(prices.get("a"), 2500);
});

test("an expired offer grants no discount", () => {
  const prices = pickAcceptedPrices([{ productId: "a", amount: 2500, expiresAt: EARLIER }], NOW);
  assert.equal(prices.get("a"), undefined);
});

test("an offer expiring exactly now is already lapsed", () => {
  assert.equal(pickAcceptedPrices([{ productId: "a", amount: 2500, expiresAt: NOW }], NOW).get("a"), undefined);
});

test("a missing expiry does not grant an open-ended discount", () => {
  // A half-written row must fail closed, not hand out a permanent price.
  assert.equal(pickAcceptedPrices([{ productId: "a", amount: 1, expiresAt: null }], NOW).get("a"), undefined);
});

test("nonsensical amounts are ignored", () => {
  for (const amount of [0, -500, 12.5, Number.NaN]) {
    const prices = pickAcceptedPrices([{ productId: "a", amount, expiresAt: LATER }], NOW);
    assert.equal(prices.get("a"), undefined, `amount ${amount} must not be accepted`);
  }
});

test("with several accepted offers the customer gets the better one", () => {
  const prices = pickAcceptedPrices([
    { productId: "a", amount: 3000, expiresAt: LATER },
    { productId: "a", amount: 2200, expiresAt: LATER },
  ], NOW);
  assert.equal(prices.get("a"), 2200);
});

test("an expired offer never wins over a valid one", () => {
  const prices = pickAcceptedPrices([
    { productId: "a", amount: 900, expiresAt: EARLIER },
    { productId: "a", amount: 2200, expiresAt: LATER },
  ], NOW);
  assert.equal(prices.get("a"), 2200, "the cheaper but lapsed offer must not apply");
});

test("cards without an offer stay untouched", () => {
  const prices = pickAcceptedPrices([{ productId: "a", amount: 2500, expiresAt: LATER }], NOW);
  assert.equal(prices.get("b"), undefined);
});

test("the validity window matches the agreed 48 hours", () => {
  assert.equal(OFFER_VALIDITY_HOURS, 48);
  assert.equal(MAX_OFFERS_PER_PRODUCT, 3);
  const expiry = offerExpiry(new Date(NOW));
  assert.equal(expiry, LATER);
});

// --- Anzeige und Abrechnung müssen dieselbe Entscheidung treffen -------------
//
// Seit dem 2026-08-08 zeigt der Checkout den ausgehandelten Preis an
// (docs/ai-todo.md, Punkt 5). Die Gefahr dabei ist nicht, dass die Anzeige
// fehlt, sondern dass sie **etwas anderes sagt als die Abrechnung** — der Kunde
// sähe einen Betrag und es würde ein anderer abgebucht. Deshalb gibt es die
// Entscheidung nur einmal, und diese Tests halten das fest.

test("die Anzeige trifft dieselbe Entscheidung wie der Bestellweg", () => {
  const rows = [
    { productId: "a", amount: 2200, expiresAt: LATER },
    { productId: "b", amount: 900, expiresAt: EARLIER },
    { productId: "c", amount: 0, expiresAt: LATER },
  ];
  const angebote = pickAcceptedOffers(rows, NOW);
  const preise = pickAcceptedPrices(rows, NOW);
  assert.deepEqual([...preise.keys()], [...angebote.keys()], "beide sehen dieselben Karten als verhandelt an");
  for (const [productId, betrag] of preise) {
    assert.equal(angebote.get(productId).amount, betrag, `Betrag für ${productId} muss übereinstimmen`);
  }
});

test("die Anzeige kennt die Gültigkeit, der Bestellweg nur den Betrag", () => {
  const angebote = pickAcceptedOffers([{ productId: "a", amount: 2200, expiresAt: LATER }], NOW);
  assert.equal(angebote.get("a").expiresAt, LATER);
  assert.equal(pickAcceptedPrices([{ productId: "a", amount: 2200, expiresAt: LATER }], NOW).get("a"), 2200);
});

test("ein angenommenes Angebot senkt den Preis", () => {
  assert.equal(effectiveUnitPrice(4500, 2200), 2200);
});

test("ohne Angebot gilt der Listenpreis", () => {
  assert.equal(effectiveUnitPrice(4500, undefined), 4500);
});

test("ein unter das Angebot gefallener Listenpreis gewinnt", () => {
  // Der Fall, der ohne gemeinsame Regel auseinanderliefe: Die Karte wurde nach
  // der Verhandlung billiger. Der Kunde zahlt den niedrigeren Preis — und muss
  // im Checkout genau den sehen, nicht das teurere Angebot.
  assert.equal(effectiveUnitPrice(1900, 2200), 1900);
});

test("ein Angebot in Höhe des Listenpreises ändert nichts", () => {
  assert.equal(effectiveUnitPrice(2200, 2200), 2200);
});

test("eine Vorverkaufskarte ist ohne Festpreis nur mit Angebot kaufbar", () => {
  assert.equal(effectiveUnitPrice(null, undefined), null);
  assert.equal(effectiveUnitPrice(null, 2200), 2200);
});
