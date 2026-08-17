import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { parseSalesOrders } = await import("../lib/ebay-read-api.ts");
const lies = (pfad) => readFile(new URL(`../${pfad}`, import.meta.url), "utf8");

// --- Der Preis vor Versand --------------------------------------------------

test("der Postenpreis ohne Versand wird getrennt vom gezahlten Betrag gefuehrt", () => {
  // eBay liefert beides: `lineItemCost` ist der reine Artikelpreis,
  // `total` derselbe Betrag zuzueglich Versand und Steuern.
  const [posten] = parseSalesOrders({
    orders: [{
      orderId: "12-345",
      creationDate: "2026-08-17T10:00:00.000Z",
      pricingSummary: { total: { value: "22.40", currency: "EUR" } },
      lineItems: [{
        lineItemId: "1",
        legacyItemId: "398200679813",
        title: "Testkarte",
        quantity: 1,
        lineItemCost: { value: "18.50", currency: "EUR" },
        total: { value: "22.40", currency: "EUR" },
      }],
    }],
  });

  assert.equal(posten.itemPriceCents, 1850, "ohne Versand");
  assert.equal(posten.amountCents, 2240, "gezahlt, mit Versand -- unveraendert");
  assert.equal(posten.orderTotalCents, 2240);
});

test("fehlt lineItemCost, bleibt das Feld leer statt auf total auszuweichen", () => {
  // Ein Rueckfall auf `total` waere eine Zahl mit anderer Bedeutung. Eine
  // Luecke ist ehrlicher -- sie laesst sich beim Auswerten ueberspringen, eine
  // falsche Zahl nicht erkennen.
  const [posten] = parseSalesOrders({
    orders: [{
      orderId: "12-346",
      creationDate: "2026-08-17T10:00:00.000Z",
      pricingSummary: { total: { value: "5.00", currency: "EUR" } },
      lineItems: [{ lineItemId: "1", title: "Ohne Postenpreis", quantity: 1, total: { value: "5.00", currency: "EUR" } }],
    }],
  });

  assert.equal(posten.itemPriceCents, null);
  assert.equal(posten.amountCents, 500, "der gezahlte Betrag bleibt davon unberuehrt");
});

// --- Die Momentaufnahme auf der Verkaufszeile -------------------------------

test("die Momentaufnahme wird nie durch eine leere ueberschrieben", async () => {
  // **Der gefaehrlichste Fall dieser Aenderung.** Wird ein Verkauf erneut
  // eingesammelt, nachdem das Angebot bei eBay verschwunden ist, ist die
  // frische Momentaufnahme leer. Ein blindes `excluded` loeschte damit genau
  // die Angabe, fuer die die Spalten angelegt wurden -- still, im Normallauf.
  const sync = await lies("lib/ebay-read-sync.ts");
  for (const spalte of ["listing_price_cents", "category_id", "condition_id"]) {
    assert.match(sync, new RegExp(`COALESCE\\(excluded\\.${spalte}, ebay_sales\\.${spalte}\\)`, "u"));
  }
  // Der Postenpreis kommt aus dem Verkauf selbst, nicht aus dem Angebot -- er
  // darf und soll sich bei einer Korrektur bei eBay aktualisieren.
  assert.match(sync, /itemPriceCents: sql`excluded\.item_price_cents`/u);
});

test("nachgeschlagen werden nur die vorkommenden Kennungen, in D1-tauglichen Haeppchen", async () => {
  const sync = await lies("lib/ebay-read-sync.ts");
  assert.match(sync, /teile\(kennungen, D1_SAFE_ID_LIST\)/u, "die Grenze wird nicht geschaetzt");
  // Die Spaltenzahl steuert die Einfuegegroesse. Vier neue Spalten und eine
  // unveraenderte 10 haetten ein "too many SQL variables" ergeben.
  assert.match(sync, /insertChunked\(rows, 14, \(chunk\) => db\.insert\(ebaySales\)/u);
});

// --- Kategorie und Zustand ---------------------------------------------------

test("Kategorie und Zustand werden ueberhaupt erst ausgelesen", async () => {
  // Beide Spalten gab es laengst -- und sie waren fuer alle 535 Angebote leer,
  // weil niemand sie befuellte.
  const client = await lies("lib/ebay-client.ts");
  assert.match(client, /xmlBlock\(itemXml, "PrimaryCategory"\)/u, "PrimaryCategory ist ein Block, kein Wert");
  assert.match(client, /digitsOrNull\(xmlValue\(itemXml, "ConditionID"\)\)/u);
});

test("die neuen Felder stehen im Vergleich, sonst schreibt jeder Lauf alles neu", async () => {
  // `stehtSchonSo` vergleicht nur, was geschrieben wird. Fehlte das Feld im
  // Lese-Select, stuende `undefined` gegen einen Wert -- ewiger Unterschied,
  // 535 Schreibvorgaenge alle drei Minuten.
  const sync = await lies("lib/ebay-sync.ts");
  const select = sync.slice(sync.indexOf("const existingListingRows"), sync.indexOf("existingListingsByItemId"));
  assert.match(select, /categoryId: ebayListings\.categoryId/u);
  assert.match(select, /conditionId: ebayListings\.conditionId/u);
});

// --- Das Preisprotokoll ------------------------------------------------------

test("eine Preisaenderung wird festgehalten, ein unveraenderter Preis nicht", async () => {
  const sync = await lies("lib/ebay-sync.ts");
  assert.match(sync, /if \(preisVorher !== preisNachher && \(existing \|\| preisNachher !== null\)\)/u);
  assert.match(sync, /db\.insert\(ebayListingPriceHistory\)/u);
  // Ein Eintrag je Lauf waere bei 535 Angeboten alle drei Minuten ein
  // Vielfaches der Nutzdaten -- derselbe Fehler wie einst bei `sync_events`.
  assert.doesNotMatch(sync, /statements\.push\(db\.insert\(ebayListingPriceHistory\)\.values\(\{\s*\}\)\)/u);
});

test("der erste beobachtete Preis hat kein Vorher, und das heisst null", async () => {
  // Eine 0 stuende fuer „war vorher gratis" und waere schlicht falsch.
  const schema = await lies("db/schema.ts");
  const tabelle = schema.slice(schema.indexOf("export const ebayListingPriceHistory"));
  assert.match(tabelle, /vorherCents: integer\("vorher_cents"\)/u, "keine NOT-NULL-Pflicht");
  assert.doesNotMatch(tabelle.slice(0, tabelle.indexOf("]);")), /\.default\(0\)/u);
});

test("die Historie haengt an der eBay-Kennung und stirbt nicht mit dem Angebot", async () => {
  // Ein Fremdschluessel mit ON DELETE cascade loeschte genau die Historie,
  // derentwegen die Tabelle existiert.
  const migration = await lies("drizzle/0016_sales_snapshot_and_price_history.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `ebay_listing_price_history`/u);
  // Geprueft wird das SQL, nicht die Begruendung darueber -- die Kommentare
  // *nennen* den Fremdschluessel ja gerade, um zu erklaeren, warum er fehlt.
  const sql = migration.split("\n").filter((zeile) => !zeile.trimStart().startsWith("--")).join("\n");
  assert.doesNotMatch(sql, /FOREIGN KEY/u);
  assert.doesNotMatch(sql, /cascade/iu);
  // Rein additiv: Die Migration darf nichts umschreiben oder loeschen.
  assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE)\b/u);
});
