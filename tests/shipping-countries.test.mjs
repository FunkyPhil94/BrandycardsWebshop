import assert from "node:assert/strict";
import test from "node:test";

const { SHIPPING_COUNTRIES, EU_COUNTRIES } = await import("../lib/shipping-countries.ts");

const EXPECTED_CODES = [
  "DE", "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "ES", "FI", "FR", "GR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
];

test("Checkout bietet alle 27 EU-Mitgliedstaaten inklusive Deutschland an", () => {
  assert.deepEqual(SHIPPING_COUNTRIES.map(({ code }) => code), EXPECTED_CODES);
  assert.equal(SHIPPING_COUNTRIES.length, 27);
  assert.equal(EU_COUNTRIES.size, 26);
  assert.ok(!EU_COUNTRIES.has("DE"), "Deutschland wird bei den Inlandskosten separat behandelt");
});

test("Versandländer haben deutsche Bezeichnungen für die Sprachumschaltung", () => {
  for (const country of SHIPPING_COUNTRIES) assert.ok(country.name.length > 1, country.code);
});
