/** Phase 9: Verkaufsübersicht mit Umsatz.
 *
 * Geprüft wird ohne eBay und ohne Datenbank. Die drei Stellen, an denen diese
 * Phase falsch werden kann, sind alle rein rechnerisch:
 *
 * 1. **Doppelzählung.** Der Bestellbetrag steht auf jedem Posten. Wer die
 *    Posten summiert, zählt eine Bestellung mit drei Karten dreifach.
 * 2. **Erfundene Nullen.** Ein fehlender Betrag ist nicht null Euro.
 * 3. **Eine halbe Grundlage.** Fehlt eBay, darf keine Gesamtsumme entstehen —
 *    sie sähe vollständig aus und wäre es nicht.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  moneyToCents,
  parseSalesOrders,
  salesWindowStart,
  EBAY_FULFILLMENT_READ_SCOPE,
  EBAY_SALES_WINDOW_DAYS,
} = await import("../lib/ebay-read-api.ts");
const {
  boundedOverviewDays,
  parseAssistantToolInput,
  SALES_OVERVIEW_DEFAULT_DAYS,
  SALES_OVERVIEW_MAX_DAYS,
  ASSISTANT_TOOL_NAMES,
  ASSISTANT_TOOL_DEFINITIONS,
} = await import("../lib/assistant/contracts.ts");
const { RuleBasedAssistantPlanner, requestedDays } = await import("../lib/assistant/planner.ts");
const { formatAssistantToolResult } = await import("../lib/assistant/response-formatter.ts");
const { ebayReadAvailability } = await import("../lib/assistant/ebay-availability.ts");

const read = (pfad) => readFile(new URL(`../${pfad}`, import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// Beträge
// ---------------------------------------------------------------------------

test("Beträge werden in Cent umgerechnet, Fehlendes bleibt fehlend", () => {
  assert.equal(moneyToCents({ value: "12.50", currency: "EUR" }), 1250);
  assert.equal(moneyToCents({ value: 9.99, currency: "EUR" }), 999);
  // 0,1 + 0,2 lässt grüßen: 19.99 * 100 ist in Gleitkomma 1998.9999...
  assert.equal(moneyToCents({ value: "19.99" }), 1999);
  // **Die entscheidenden drei.** `Number(null)`, `Number("")` und
  // `Number(undefined)` sind 0 bzw. NaN -- ein fehlender Betrag als "null Euro"
  // wäre eine erfundene Zahl im Umsatz.
  assert.equal(moneyToCents({ value: null }), null);
  assert.equal(moneyToCents({ value: "" }), null);
  assert.equal(moneyToCents(undefined), null);
  assert.equal(moneyToCents({ value: "keine Zahl" }), null);
});

// ---------------------------------------------------------------------------
// Zerlegung der Bestellliste
// ---------------------------------------------------------------------------

const BESTELLUNG_MIT_ZWEI_POSTEN = {
  orders: [{
    orderId: "12-34567-89012",
    creationDate: "2026-08-15T09:53:34.953Z",
    pricingSummary: { total: { value: "45.00", currency: "EUR" } },
    lineItems: [
      { lineItemId: "L1", legacyItemId: "398213774736", title: "Marcelo Flare Patch", quantity: 1, total: { value: "30.00", currency: "EUR" } },
      { lineItemId: "L2", legacyItemId: "398174236865", title: "Nucleus 57/75", quantity: 2, total: { value: "15.00", currency: "EUR" } },
    ],
  }],
};

test("eine Bestellung mit zwei Posten ergibt zwei Zeilen mit demselben Bestellbetrag", () => {
  const zeilen = parseSalesOrders(BESTELLUNG_MIT_ZWEI_POSTEN);
  assert.equal(zeilen.length, 2);
  // Der Bestellbetrag wird wiederholt, nicht aufgeteilt: Versand und Steuern
  // nach einem Schlüssel zu verteilen, den eBay nicht mitliefert, wäre geraten.
  assert.deepEqual(zeilen.map((zeile) => zeile.orderTotalCents), [4500, 4500]);
  assert.deepEqual(zeilen.map((zeile) => zeile.amountCents), [3000, 1500]);
  assert.deepEqual(zeilen.map((zeile) => zeile.quantity), [1, 2]);
  assert.deepEqual(zeilen.map((zeile) => zeile.ebayItemId), ["398213774736", "398174236865"]);
  assert.equal(zeilen[0].soldAt, "2026-08-15T09:53:34.953Z");
});

test("der Umsatz summiert über Bestellungen, nicht über Posten", () => {
  const zeilen = parseSalesOrders(BESTELLUNG_MIT_ZWEI_POSTEN);
  // So rechnet das Werkzeug: erst je Bestellung eindeutig machen, dann summieren.
  const jeBestellung = new Map(zeilen.map((zeile) => [zeile.ebayOrderId, zeile.orderTotalCents]));
  const umsatz = [...jeBestellung.values()].reduce((summe, wert) => summe + (wert ?? 0), 0);
  assert.equal(umsatz, 4500);
  // Der naive Weg wäre 9 000 -- doppelt so viel, und nichts an der Zahl sähe
  // falsch aus.
  const naiv = zeilen.reduce((summe, zeile) => summe + (zeile.orderTotalCents ?? 0), 0);
  assert.equal(naiv, 9000);
});

test("Posten ohne eigene Kennung fallen nicht zusammen", () => {
  const zeilen = parseSalesOrders({
    orders: [{
      orderId: "X-1",
      creationDate: "2026-08-01T00:00:00.000Z",
      pricingSummary: { total: { value: "10.00", currency: "EUR" } },
      lineItems: [{ title: "A", quantity: 1 }, { title: "B", quantity: 1 }],
    }],
  });
  assert.equal(new Set(zeilen.map((zeile) => zeile.lineItemId)).size, 2, "zwei Posten, zwei Schluessel");
});

test("leere, lueckenhafte und kaputte Antworten erfinden nichts", () => {
  assert.deepEqual(parseSalesOrders({ orders: [] }), []);
  assert.deepEqual(parseSalesOrders({}), []);
  // Bestellung ohne Kennung wird uebersprungen statt mit leerem Schluessel
  // gespeichert -- sonst kollidierten zwei davon im eindeutigen Index.
  assert.deepEqual(parseSalesOrders({ orders: [{ creationDate: "2026-08-01T00:00:00.000Z", lineItems: [{ title: "A" }] }] }), []);
  assert.throws(() => parseSalesOrders("kaputt"), /kein Objekt/u);

  const ohneBetraege = parseSalesOrders({
    orders: [{ orderId: "Y-1", creationDate: "2026-08-01T00:00:00.000Z", lineItems: [{ lineItemId: "L", title: "A" }] }],
  });
  assert.equal(ohneBetraege[0].amountCents, null);
  assert.equal(ohneBetraege[0].orderTotalCents, null);
  // Menge ohne Angabe ist 1, nicht 0: Ein verkaufter Posten ist mindestens eine
  // Karte, und 0 wuerde die Kartenzahl stillschweigend kleinrechnen.
  assert.equal(ohneBetraege[0].quantity, 1);
});

test("das Abfragefenster endet offen und beginnt beim gewuenschten Tag", () => {
  const jetzt = new Date("2026-08-16T18:00:00.000Z");
  assert.equal(salesWindowStart(jetzt, 30), "2026-07-17T18:00:00.000Z");
  assert.equal(EBAY_SALES_WINDOW_DAYS, 90);
});

// ---------------------------------------------------------------------------
// Zeitraum
// ---------------------------------------------------------------------------

test("der Zeitraum wird aus der Frage gelesen, nicht aus der Ergebniszahl", () => {
  assert.equal(requestedDays("verkaeufe der letzten 30 tage"), 30);
  assert.equal(requestedDays("was habe ich in 2 wochen verkauft"), 14);
  assert.equal(requestedDays("umsatz der letzten 3 monate"), 90);
  assert.equal(requestedDays("umsatz diese woche"), 7);
  assert.equal(requestedDays("was habe ich verkauft"), undefined);
});

test("days wird begrenzt, aber eine unsinnige Anfrage wird abgewiesen", () => {
  assert.equal(boundedOverviewDays(undefined), SALES_OVERVIEW_DEFAULT_DAYS);
  assert.equal(boundedOverviewDays(400), SALES_OVERVIEW_MAX_DAYS);
  assert.equal(boundedOverviewDays(0), 1);
  assert.equal(boundedOverviewDays(30), 30);
  // Der Unterschied ist Absicht: Was von aussen hereinkommt, wird geprueft und
  // abgelehnt; was intern weitergereicht wird, in die Schranken gewiesen.
  assert.deepEqual(parseAssistantToolInput({ tool: "sales_overview", limit: 5, days: 30 }), { tool: "sales_overview", limit: 5, days: 30 });
  assert.throws(() => parseAssistantToolInput({ tool: "sales_overview", limit: 5, days: 4000 }), /days muss/u);
  assert.throws(() => parseAssistantToolInput({ tool: "sales_overview", limit: 5, days: 1.5 }), /days muss/u);
  assert.throws(() => parseAssistantToolInput({ tool: "sales_overview", limit: 5, zeitraum: 30 }), /Nicht unterstuetzte Felder|Nicht unterstützte Felder/u);
});

// ---------------------------------------------------------------------------
// Planer
// ---------------------------------------------------------------------------

test("die Frage nach dem Zeitraum landet bei der Uebersicht, nicht beim letzten Verkauf", async () => {
  const planer = new RuleBasedAssistantPlanner();

  const mitZeitraum = await planer.plan("Was habe ich in den letzten 30 Tagen verkauft?");
  const uebersicht = mitZeitraum.tools.find((eintrag) => eintrag.tool === "sales_overview");
  assert.ok(uebersicht, "sales_overview muss geplant werden");
  assert.equal(uebersicht.days, 30);
  // Vor latest_sale: Die Reihenfolge entscheidet, welche Antwort zuerst steht.
  assert.ok(mitZeitraum.tools.indexOf(uebersicht) < mitZeitraum.tools.findIndex((eintrag) => eintrag.tool === "latest_sale"));

  const nurUmsatz = await planer.plan("Wie viel Umsatz habe ich gemacht?");
  assert.ok(nurUmsatz.tools.some((eintrag) => eintrag.tool === "sales_overview"));

  // Ohne Zeitraum und ohne Umsatz bleibt es bei der alten Frage nach dem einen
  // letzten Verkauf -- sonst bekaeme "was ging zuletzt weg?" eine Liste.
  const ohneZeitraum = await planer.plan("Was wurde zuletzt verkauft?");
  assert.ok(!ohneZeitraum.tools.some((eintrag) => eintrag.tool === "sales_overview"));
  assert.ok(ohneZeitraum.tools.some((eintrag) => eintrag.tool === "latest_sale"));
});

// ---------------------------------------------------------------------------
// Antworttext
// ---------------------------------------------------------------------------

function uebersicht(ebayKanal, gesamt) {
  return {
    tool: "sales_overview",
    status: "AVAILABLE",
    readOnly: true,
    sources: ["SHOP_DB"],
    freshness: null,
    data: {
      days: 30,
      since: "2026-07-17T18:00:00.000Z",
      revenueBasis: "Bruttoumsatz: was Käufer gezahlt haben, inklusive des von ihnen getragenen Versands, vor eBay-Gebühren.",
      currency: "EUR",
      channels: {
        shop: { available: true, orderCount: 2, itemCount: 3, revenueCents: 5000, currency: "EUR", unavailableCode: null, unavailableMessage: null },
        ebay: ebayKanal,
      },
      totalRevenueCents: gesamt,
      totalItemCount: gesamt === null ? null : 8,
      sales: [],
    },
  };
}

test("fehlt die eBay-Haelfte, wird keine Gesamtsumme behauptet und keine Null erfunden", () => {
  const text = formatAssistantToolResult(uebersicht({
    available: false,
    orderCount: 0,
    itemCount: 0,
    revenueCents: null,
    currency: "EUR",
    unavailableCode: "SCOPE_NOT_GRANTED",
    unavailableMessage: "eBay-Verkäufe: eBay verweigert den lesenden Zugriff.",
  }, null));

  assert.match(text, /eBay-Verkäufe: eBay verweigert den lesenden Zugriff/u);
  assert.match(text, /Gesamt: nicht ausgewiesen/u);
  // Der eigentliche Punkt: kein "eBay: 0 Bestellung(en)". Eine Null waere hier
  // eine Aussage ueber eBay, die niemand geprueft hat.
  assert.doesNotMatch(text, /eBay: 0 Bestellung/u);
  // Die Shop-Haelfte steht trotzdem da -- ein fehlender Kanal darf den
  // vorhandenen nicht mitnehmen.
  assert.match(text, /Shop: 2 Bestellung\(en\), 3 Karte\(n\), 50,00/u);
});

test("sind beide Haelften da, steht die Gesamtsumme mit ihrer Bezugsgroesse", () => {
  const text = formatAssistantToolResult(uebersicht({
    available: true,
    orderCount: 5,
    itemCount: 5,
    revenueCents: 12345,
    currency: "EUR",
    unavailableCode: null,
    unavailableMessage: null,
  }, 17345));

  assert.match(text, /eBay: 5 Bestellung\(en\), 5 Karte\(n\), 123,45/u);
  assert.match(text, /Gesamt: 8 Karte\(n\), 173,45/u);
  // Eine Umsatzzahl ohne Bezugsgroesse ist keine Auskunft.
  assert.match(text, /vor eBay-Gebühren/u);
});

test("der Scope-Hinweis nennt das fehlende Recht beim Namen", () => {
  const zustand = ebayReadAvailability({ status: "SCOPE_NOT_GRANTED", lastSuccessAt: null }, "eBay-Verkäufe");
  assert.equal(zustand.available, false);
  assert.match(zustand.message, /sell\.fulfillment\.readonly/u);
  assert.equal(EBAY_FULFILLMENT_READ_SCOPE, "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly");

  // Noch nie abgerufen ist etwas anderes als abgelehnt.
  assert.equal(ebayReadAvailability(undefined, "eBay-Verkäufe").code, "NOT_SYNCED");
});

// ---------------------------------------------------------------------------
// Verdrahtung und Migration
// ---------------------------------------------------------------------------

test("das Werkzeug ist vollstaendig verdrahtet", async () => {
  assert.ok(ASSISTANT_TOOL_NAMES.includes("sales_overview"));
  const definition = ASSISTANT_TOOL_DEFINITIONS.find((eintrag) => eintrag.name === "sales_overview");
  // Nicht READY: Die Shop-Haelfte kann immer antworten, die eBay-Haelfte nur so
  // gut, wie der Lesesync sie geholt hat.
  assert.equal(definition.availability, "SOURCE_DEPENDENT");
  assert.match(await read("lib/assistant/server-tool-registry.ts"), /sales_overview: \(input\) => getSalesOverview\(input\)/u);
});

test("die Migration erhaelt die bestehenden Zustandszeilen", async () => {
  const migration = await read("drizzle/0013_ebay_sales_history.sql");
  // SQLite kann eine CHECK-Bedingung nicht aendern, die Tabelle muss neu
  // gebaut werden. Ohne das INSERT ... SELECT waeren die drei bestehenden
  // Zeilen weg und der Assistant meldete faelschlich NOT_SYNCED.
  assert.match(migration, /INSERT INTO `ebay_read_syncs_neu`[\s\S]*SELECT[\s\S]*FROM `ebay_read_syncs`/u);
  assert.ok(migration.indexOf("INSERT INTO `ebay_read_syncs_neu`") < migration.indexOf("DROP TABLE `ebay_read_syncs`"), "erst retten, dann loeschen");
  assert.match(migration, /CHECK\("ebay_read_syncs_neu"\."data_type" IN \('TRAFFIC', 'MESSAGES', 'BEST_OFFERS', 'SALES'\)\)/u);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS `ebay_read_syncs_type_unique`/u, "der eindeutige Index muss neu angelegt werden");
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS `ebay_sales_line_unique` ON `ebay_sales` \(`ebay_order_id`, `line_item_id`\)/u);
});

test("die Verkaufstabelle traegt keine Kaeuferdaten", async () => {
  const schema = await read("db/schema.ts");
  const block = schema.slice(schema.indexOf("export const ebaySales"), schema.indexOf("export const auditEvents"));
  for (const feld of ["buyer", "kaeufer", "address", "anschrift", "email", "username"]) {
    assert.doesNotMatch(block, new RegExp(feld, "iu"), `${feld} hat in der Verkaufstabelle nichts zu suchen`);
  }
});
