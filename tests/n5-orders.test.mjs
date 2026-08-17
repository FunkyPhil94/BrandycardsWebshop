import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const { normalizeShippingCarrier, normalizeTrackingNumber, trackingUrl } = await import("../lib/shipping.ts");
const { orderRefunded, orderShipped } = await import("../lib/email/templates.ts");

test("Versanddaten werden auf bekannte Anbieter und druckbare Nummern begrenzt", () => {
  assert.equal(normalizeShippingCarrier("DHL"), "DHL");
  assert.equal(normalizeShippingCarrier("unknown.example"), null);
  assert.equal(normalizeTrackingNumber("00340434161094000000"), "00340434161094000000");
  assert.equal(normalizeTrackingNumber("<script>"), null);
  assert.ok(trackingUrl("DHL", "00340434161094000000")?.startsWith("https://www.dhl.de/"));
  assert.equal(trackingUrl("DHL", null), null);
});

test("Versand- und Erstattungsnachrichten enthalten keine unmaskierten Links", () => {
  const shipped = orderShipped({
    orderNumber: "BC-20260810-TEST",
    shippedAt: "2026-08-10T10:00:00.000Z",
    carrier: "DHL",
    trackingNumber: "00340434161094000000",
    trackingUrl: "https://www.dhl.de/track?id=00340434161094000000",
    shopUrl: "https://shop.brandycards.de",
  });
  assert.match(shipped.text, /Bestellung ist unterwegs/u);
  assert.match(shipped.text, /00340434161094000000/u);
  assert.ok(shipped.html.includes("https://www.dhl.de/track?id=00340434161094000000"));
  assert.ok(!shipped.html.includes("<script>"));

  const refunded = orderRefunded({ orderNumber: "BC-20260810-TEST", amount: { cents: 1345, currency: "EUR" }, shopUrl: "https://shop.brandycards.de" });
  assert.match(refunded.subject, /Erstattung/u);
  assert.match(refunded.text, /13,45/u);
});

test("N5-Bestellpfade schützen Eigentümer und Adminaktionen", async () => {
  const accountRoute = await read("app/api/account/orders/route.ts");
  assert.match(accountRoute, /getAuthenticatedAppUser/);
  assert.match(accountRoute, /eq\(orders\.userId, appUser\.id\)/);
  for (const route of [
    "app/api/admin/orders/route.ts",
    "app/api/admin/orders/cancel/route.ts",
    "app/api/admin/orders/refund/route.ts",
  ]) {
    assert.match(await read(route), /requireAdmin/);
  }
  // Nur die Erstattung fragt erneut nach dem Code: Dort verlässt Geld das Haus.
  // Ein Storno greift ausschließlich bei noch unbezahlten Bestellungen und
  // bewegt nichts; „versendet" und „abgeschlossen" sind tägliche Arbeit.
  assert.match(await read("app/api/admin/orders/refund/route.ts"), /recentAuthSeconds: 600/);
  assert.doesNotMatch(await read("app/api/admin/orders/cancel/route.ts"), /recentAuthSeconds/);
  assert.doesNotMatch(await read("app/api/admin/orders/route.ts"), /recentAuthSeconds/);
});

test("die Auftragstabelle besitzt die Nachverfolgungs- und Abschlusszeitpunkte", async () => {
  const schema = await read("db/schema.ts");
  const migration = await read("drizzle/0007_order_fulfillment.sql");
  for (const column of ["shippedAt", "shippingCarrier", "trackingNumber", "completedAt", "cancelledAt", "refundedAt"]) assert.match(schema, new RegExp(column));
  for (const column of ["shipped_at", "shipping_carrier", "tracking_number", "completed_at", "cancelled_at", "refunded_at"]) assert.match(migration, new RegExp(column));
});
