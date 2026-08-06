import assert from "node:assert/strict";
import test from "node:test";

const { pickAcceptedPrices, offerExpiry, OFFER_VALIDITY_HOURS, MAX_OFFERS_PER_PRODUCT } =
  await import("../lib/price-offers.ts");

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
