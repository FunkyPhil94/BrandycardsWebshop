import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const orderRoute = await read("app/api/orders/route.ts");
const paypalOrderRoute = await read("app/api/paypal/orders/route.ts");
const captureRoute = await read("app/api/paypal/capture/route.ts");
const releaseRoute = await read("app/api/orders/release/route.ts");
const successPage = await read("app/checkout/paypal/success/page.tsx");
const cancelPage = await read("app/checkout/paypal/cancel/page.tsx");
const settleOrder = await read("lib/paypal/settle-order.ts");

test("Gastbestellungen speichern E-Mail und reservieren pro Gast", () => {
  assert.match(orderRoute, /customerEmail/);
  assert.match(orderRoute, /guestEmail/);
  assert.match(orderRoute, /reservedUnitsForGuest/);
  assert.match(orderRoute, /userId: appUser\?\.id \?\? null/);
  assert.doesNotMatch(orderRoute, /if \(!appUser\) return NextResponse\.json\(\{ error: "Bitte melde dich/);
  assert.match(settleOrder, /reservedUnitsForGuest/);
  assert.match(settleOrder, /guestEmail\?: string/);
});

test("PayPal- und Reservierungsrouten prüfen Konto oder Gastbestellung", () => {
  for (const route of [paypalOrderRoute, captureRoute, releaseRoute]) {
    assert.match(route, /ownerMatches/);
    assert.doesNotMatch(route, /if \(!appUser\) return NextResponse\.json\(\{ error: "Nicht authentifiziert/);
  }
  assert.match(paypalOrderRoute, /order\?\.userId === null && Boolean\(order\?\.guestEmail\)/);
  assert.match(captureRoute, /order\?\.userId === null && Boolean\(order\?\.guestEmail\)/);
  assert.match(releaseRoute, /order\?\.userId === null && Boolean\(order\?\.guestEmail\)/);
});

test("PayPal-Rückkehrseiten funktionieren auch ohne Supabase-Sitzung", () => {
  assert.match(successPage, /if \(!paypalOrderId \|\| !orderId\)/);
  assert.match(successPage, /captureHeaders/);
  assert.match(cancelPage, /if \(orderId\)/);
  assert.match(cancelPage, /headers/);
});