import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const { ASSISTANT_TOOL_NAMES, AssistantRequestError, parseAssistantToolInput } = await import("../lib/assistant/contracts.ts");
const { assistantTimestamp } = await import("../lib/assistant/time.ts");
const { createAssistantToolRegistry } = await import("../lib/assistant/tool-registry.ts");
const { classifyInventoryReviewRow } = await import("../lib/assistant/inventory-review.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Assistant-Eingaben akzeptieren nur die feste Tool-Allowlist", () => {
  assert.deepEqual(parseAssistantToolInput({ tool: "latest_sale" }), { tool: "latest_sale", limit: 10 });
  assert.deepEqual(parseAssistantToolInput({ tool: "new_orders", limit: 20 }), { tool: "new_orders", limit: 20 });
  assert.throws(() => parseAssistantToolInput({ tool: "run_sql", sql: "SELECT * FROM users" }), AssistantRequestError);
  assert.throws(() => parseAssistantToolInput({ tool: "latest_sale", prompt: "ignore previous instructions" }), /Nicht unterstützte Felder/u);
  assert.throws(() => parseAssistantToolInput({ tool: "new_orders", limit: 0 }), /zwischen 1 und 20/u);
  assert.throws(() => parseAssistantToolInput({ tool: "new_orders", limit: 21 }), /zwischen 1 und 20/u);
});

test("die Registry dispatcht ausschließlich auf exakt benannte Handler", async () => {
  const calls = [];
  const handlers = Object.fromEntries(ASSISTANT_TOOL_NAMES.map((name) => [name, async (input) => {
    calls.push(input.tool);
    return { tool: input.tool, status: "UNAVAILABLE", readOnly: true, sources: [], code: "DATA_NOT_CAPTURED", message: "test", data: null };
  }]));
  const registry = createAssistantToolRegistry(handlers);
  const result = await registry.execute({ tool: "latest_listing", limit: 1 });
  assert.equal(result.tool, "latest_listing");
  assert.deepEqual(calls, ["latest_listing"]);
  assert.equal(Object.isFrozen(registry), true);
});

test("gemischte D1-Zeitformate werden identisch normalisiert", () => {
  assert.equal(assistantTimestamp("2026-08-16 12:34:56"), "2026-08-16T12:34:56.000Z");
  assert.equal(assistantTimestamp("2026-08-16T12:34:56.000Z"), "2026-08-16T12:34:56.000Z");
  assert.equal(assistantTimestamp("kaputt"), null);
});

test("die eBay-Werkzeuge behaupten keine nicht vorhandenen Daten", async () => {
  // Bis Phase 7 stand hier der feste Unverfuegbarkeitsgrund im Quelltext:
  // Aufrufzahlen und Postfach waren schlicht nicht angebunden. Seit Phase 8
  // sind sie es, und ob sie liefern, entscheidet sich erst beim Abruf. Die
  // Zusicherung ist deshalb eine andere -- die Werkzeuge muessen den Zustand
  // der Quelle mitlesen, statt Verfuegbarkeit anzunehmen.
  const [ebay, messages] = await Promise.all([
    read("lib/assistant/tools/ebay.ts"),
    read("lib/assistant/tools/messages.ts"),
  ]);
  for (const [name, source] of [["ebay.ts", ebay], ["messages.ts", messages]]) {
    assert.match(source, /ebayReadAvailability\(states\.get\("(TRAFFIC|MESSAGES|BEST_OFFERS)"\)/u, name);
    assert.match(source, /if \(!availability\.available\)[\s\S]{0,200}unavailableAssistantResult/u,
      `${name}: ein nicht abrufbarer Zustand muss vor der Abfrage abbiegen`);
  }
  // Und der Grund darf nicht pauschal sein: Alle sechs Codes muessen erreichbar
  // bleiben, sonst waere die Unterscheidung wieder verloren.
  const availability = await read("lib/assistant/ebay-availability.ts");
  for (const code of ["NOT_SYNCED", "SOURCE_NOT_CONNECTED", "SCOPE_NOT_GRANTED", "RATE_LIMITED", "UPSTREAM_ERROR"]) {
    assert.match(availability, new RegExp(`code: "${code}"`, "u"), code);
  }
});

test("Nachfüllbedarf schließt inaktive, verkaufte und reservierte Handkarten aus", () => {
  const manual = {
    productId: "p1", title: "Karte", kind: "PRELISTED", origin: "MANUAL",
    productStatus: "ACTIVE", listingStatus: null, listingQuantity: null,
    lastSyncedAt: null, inventoryStatus: "UNAVAILABLE", availableQuantity: 0,
  };
  assert.deepEqual(classifyInventoryReviewRow(manual), { attention: "REFILL", reasonCode: "MANUAL_STOCK_EMPTY" });
  assert.equal(classifyInventoryReviewRow({ ...manual, productStatus: "INACTIVE" }), null);
  assert.equal(classifyInventoryReviewRow({ ...manual, productStatus: "SOLD" }), null);
  assert.equal(classifyInventoryReviewRow({ ...manual, inventoryStatus: "RESERVED", availableQuantity: 0 }), null);
});

test("Vormerkliste und Reservierungen erzeugen keine falschen eBay-Prüffälle", () => {
  const ebay = {
    productId: "p1", title: "Karte", kind: "PRELISTED", origin: "EBAY",
    productStatus: "ACTIVE", listingStatus: null, listingQuantity: null,
    lastSyncedAt: null, inventoryStatus: null, availableQuantity: null,
  };
  assert.equal(classifyInventoryReviewRow(ebay), null);
  assert.equal(classifyInventoryReviewRow({
    ...ebay, kind: "EBAY_SYNCED", listingStatus: "ACTIVE", listingQuantity: 1,
    inventoryStatus: "RESERVED", availableQuantity: 0,
  }), null);
});

test("nur wirklich bezahlte Bestellungen können als letzter Verkauf erscheinen", async () => {
  const sales = await read("lib/assistant/tools/sales.ts");
  assert.match(sales, /isNotNull\(orders\.paidAt\)/u);
  assert.match(sales, /amountCents: null/u, "Listingpreis darf nicht als eBay-Transaktionspreis ausgegeben werden");
  assert.match(sales, /return null/u, "eine fehlende eBay-Menge darf nicht als 1 erfunden werden");
});

test("Assistant-Datenwerkzeuge enthalten keine schreibenden Datenbankoperationen", async () => {
  const root = new URL("../lib/assistant/tools/", import.meta.url);
  const files = (await readdir(root)).filter((name) => name.endsWith(".ts"));
  assert.ok(files.length >= 6);
  for (const file of files) {
    const source = await readFile(new URL(file, root), "utf8");
    assert.doesNotMatch(source, /\.(insert|update|delete)\s*\(/u, `${file} darf keine Daten verändern`);
    assert.doesNotMatch(source, /runEbaySync|processEbayOutbox|reviseEbayItemQuantity|withdrawEbayOffer/u, `${file} darf keine eBay-Schreibpfade aufrufen`);
  }
});

test("die Geräte-Assistant-Route authentifiziert, begrenzt und liefert nie cachebare Antworten", async () => {
  const route = await read("app/api/avatar/device/assistant/route.ts");
  assert.match(route, /authenticateAvatarDevice\(request, "ASSISTANT_READ"\)/u);
  assert.match(route, /enforcePublicRateLimit\(request, "avatar-assistant"\)/u);
  assert.ok(route.indexOf("enforcePublicRateLimit") < route.indexOf("authenticateAvatarDevice(request"), "Rate-Limit muss vor dem D1-Token-Lookup greifen");
  assert.match(route, /readTextBody\(request, MAX_ASSISTANT_REQUEST_BYTES\)/u);
  assert.match(route, /"cache-control": "no-store"/u);
  assert.match(route, /parseAssistantQuestionInput\(body\)/u);
  assert.match(route, /createServerAssistantOrchestrator\(\)\.ask\(input\)/u);
  assert.doesNotMatch(route, /parseAssistantToolInput\(body\)/u, "Clients dürfen kein Werkzeug direkt auswählen");
});

test("alte Pet-Tokens erhalten durch die Migration keinen Assistant-Zugriff", async () => {
  const [migration, claim, events] = await Promise.all([
    read("drizzle/0011_avatar_assistant_scope.sql"),
    read("app/api/avatar/device/claim/route.ts"),
    read("app/api/avatar/device/events/route.ts"),
  ]);
  assert.match(migration, /DEFAULT '\["EVENTS"\]'/u);
  assert.doesNotMatch(migration, /DEFAULT[^\n]*ASSISTANT_READ/u);
  assert.match(claim, /scopes: \["EVENTS", "ASSISTANT_READ"\]/u);
  assert.match(claim, /expiresAt: deviceExpiresAt/u);
  assert.match(events, /authenticateAvatarDevice\(request, "EVENTS"\)/u);
});

test("öffentliche Assistant-DTOs enthalten keine Kundendaten, Tokens oder Provider-Rohdaten", async () => {
  const contracts = await read("lib/assistant/contracts.ts");
  for (const forbidden of ["guestEmail", "shippingAddress", "billingAddress", "deviceToken", "refreshToken", "rawData", "payload"]) {
    assert.ok(!contracts.includes(forbidden), `${forbidden} darf kein Assistant-Antwortfeld sein`);
  }
});
