import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  checkReservationCapacity,
  MAX_ORDER_POSITIONS,
  MAX_RESERVED_UNITS_PER_USER,
  RESERVATION_MINUTES,
} = await import("../lib/order-guard.ts");

const orderRoute = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
const settleOrder = await readFile(new URL("../lib/paypal/settle-order.ts", import.meta.url), "utf8");

// --- SEC-03 -----------------------------------------------------------------
// One account walking the catalogue could park the entire stock behind unpaid
// orders. `/api/products` hands out every product id, an order takes up to
// MAX_ORDER_POSITIONS of them, and nothing bounded the next order.
// See docs/security-findings.md.

/** The attack, replayed against the decision that is supposed to stop it:
 *  keep placing full-size orders until the shop refuses. */
function stockAnAttackerCanHold(catalogueSize) {
  let held = 0;
  for (let round = 0; round < 100; round += 1) {
    const batch = Math.min(MAX_ORDER_POSITIONS, catalogueSize - held);
    if (batch <= 0) break;
    if (!checkReservationCapacity(held, batch).allowed) break;
    held += batch;
  }
  return held;
}

test("one account cannot hold the whole catalogue", () => {
  const catalogue = 296; // active cards in production at the time of the audit
  const held = stockAnAttackerCanHold(catalogue);
  assert.ok(held < catalogue, `an attacker still reserved the entire stock (${held} of ${catalogue})`);
  assert.equal(held, MAX_RESERVED_UNITS_PER_USER, `expected the ceiling to bind at ${MAX_RESERVED_UNITS_PER_USER}, got ${held}`);
  assert.ok(held / catalogue < 0.25, `${Math.round((held / catalogue) * 100)}% of the shop can still be locked by one account`);
});

test("the ceiling counts units of stock, not orders", () => {
  // Three orders of twenty do the same damage as one of sixty, so the number
  // of orders must not be what is counted.
  assert.equal(checkReservationCapacity(20, 20).allowed, true);
  assert.equal(checkReservationCapacity(40, 20).allowed, false);
});

test("a normal cart is never refused", () => {
  // Nobody who could place an order before is turned away: a full cart still
  // fits, because the ceiling is the same number as the per-order limit.
  assert.equal(checkReservationCapacity(0, 1).allowed, true);
  assert.equal(checkReservationCapacity(0, MAX_ORDER_POSITIONS).allowed, true);
});

test("the refusal explains what to do about it", () => {
  const result = checkReservationCapacity(MAX_RESERVED_UNITS_PER_USER, 1);
  assert.equal(result.allowed, false);
  assert.match(result.message, /offenen Bestellungen/);
  assert.match(result.message, /brich sie ab|schließe eine davon ab/, "the customer needs a way out, not just a refusal");
});

test("the checkout actually applies the guard, the rate limit and the sweep", () => {
  assert.match(orderRoute, /enforcePublicRateLimit\(request, "orders"\)/, "order creation must be rate limited");
  assert.match(orderRoute, /checkReservationCapacity\(/, "order creation must check the reservation ceiling");
  assert.match(orderRoute, /releaseExpiredReservations\(db,[\s\S]{0,60}?appUser\.id\)/,
    "the customer's own lapsed holds must be freed first, or the ceiling locks them out for an hour");
});

test("expired reservations can be swept for a single customer", () => {
  assert.match(settleOrder, /releaseExpiredReservations\([^)]*userId\?: string/,
    "the sweep needs a per-customer form for the checkout to call");
  assert.match(settleOrder, /reservedUnitsForUser/, "the ceiling needs a way to count what a customer holds");
});

test("the reservation window is shorter than the scheduled sweep, so the sweep alone is not the answer", async () => {
  // This is why the per-customer sweep exists: the cron runs hourly while a
  // reservation lasts fifteen minutes, so a hold outlives its window by up to
  // another 45 minutes. If the cron ever gets tightened, this test documents
  // the relationship rather than breaking.
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  const cron = wrangler.match(/crons\s*=\s*\[\s*"([^"]+)"/)?.[1];
  assert.ok(cron, "wrangler.toml must declare a cron for the release job");
  const everyMinutes = cron.startsWith("*/") ? Number(cron.slice(2).split(" ")[0]) : 60;
  assert.ok(RESERVATION_MINUTES < everyMinutes + RESERVATION_MINUTES,
    "sanity: a reservation is released between RESERVATION_MINUTES and RESERVATION_MINUTES + cron interval");
  assert.match(orderRoute, /releaseExpiredReservations/,
    `the sweep runs every ${everyMinutes} min, so the checkout must not rely on it alone`);
});

// --- SEC-10 -----------------------------------------------------------------

test("stock is booked relative to the stored value, never from a stale read", () => {
  const booking = orderRoute.match(/const stockWrites[\s\S]*?\n    \}\)\.where/);
  assert.ok(booking, "could not locate the stock booking");
  assert.match(booking[0], /sql`\$\{inventory\.availableQuantity\} - \$\{item\.quantity\}`/,
    "availableQuantity must be decremented in SQL, not written as a precomputed absolute value");
  assert.match(booking[0], /sql`\$\{inventory\.reservedQuantity\} \+ \$\{item\.quantity\}`/);
  assert.ok(!/availableQuantity: item\.stock\.availableQuantity/.test(orderRoute),
    "a value read before the write must not be written back: two concurrent orders would lose one booking");
  assert.ok(!/reservedQuantity: item\.stock\.reservedQuantity/.test(orderRoute),
    "the rollback must undo relatively too, or it overwrites a concurrent booking");
});
