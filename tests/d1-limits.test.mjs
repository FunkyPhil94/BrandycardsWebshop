import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { inArray } from "drizzle-orm";

// Guards against "D1_ERROR: too many SQL variables". D1 caps bound parameters
// per statement, so the deactivation sweep in lib/ebay-sync.ts has to size its
// chunks from the widest statement it generates. These tests measure the SQL
// drizzle actually produces instead of trusting a hand-counted estimate.

const { syncEvents, ebayListings, products, inventory } = await import("../db/schema.ts");
const { D1_MAX_BOUND_PARAMS, D1_SAFE_ID_LIST, maxInsertRows } = await import("../lib/d1-limits.ts");

const db = drizzle(async () => ({ rows: [] }));
const SYNC_EVENT_INSERT_COLUMNS = 6;

function params(query) {
  return query.toSQL().params.length;
}

test("bulk sync-event insert stays under the D1 parameter ceiling", () => {
  const rowCount = maxInsertRows(SYNC_EVENT_INSERT_COLUMNS);
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    syncRunId: "run", ebayItemId: `item-${i}`, productId: `product-${i}`,
    status: "DEACTIVATED", message: "Angebot nicht mehr in eBay-Aktivliste vorhanden.", createdAt: "2026-08-06T00:00:00.000Z",
  }));
  const used = params(db.insert(syncEvents).values(rows));
  assert.ok(used <= D1_MAX_BOUND_PARAMS, `insert of ${rowCount} rows binds ${used} parameters, limit is ${D1_MAX_BOUND_PARAMS}`);
});

test("id-list updates stay under the D1 parameter ceiling", () => {
  const ids = Array.from({ length: D1_SAFE_ID_LIST }, (_, i) => `id-${i}`);
  const now = "2026-08-06T00:00:00.000Z";
  const statements = [
    db.update(ebayListings).set({ status: "ENDED", updatedAt: now }).where(inArray(ebayListings.id, ids)),
    db.update(products).set({ status: "INACTIVE", updatedAt: now }).where(inArray(products.id, ids)),
    db.update(inventory).set({ status: "UNAVAILABLE", availableQuantity: 0, updatedAt: now }).where(inArray(inventory.productId, ids)),
  ];
  for (const statement of statements) {
    const used = params(statement);
    assert.ok(used <= D1_MAX_BOUND_PARAMS, `update binds ${used} parameters, limit is ${D1_MAX_BOUND_PARAMS}`);
  }
});

test("the chunk size that caused the outage would now be rejected", () => {
  // 50 rows x 6 columns = 300 parameters. This is the statement that failed in
  // production with "too many SQL variables at offset 1070".
  const rows = Array.from({ length: 50 }, (_, i) => ({
    syncRunId: "run", ebayItemId: `item-${i}`, productId: `product-${i}`,
    status: "DEACTIVATED", message: "m", createdAt: "2026-08-06T00:00:00.000Z",
  }));
  assert.ok(params(db.insert(syncEvents).values(rows)) > D1_MAX_BOUND_PARAMS, "regression fixture must exceed the limit");
  assert.ok(maxInsertRows(SYNC_EVENT_INSERT_COLUMNS) < 50, "chosen chunk size must be smaller than the failing one");
});

test("die Bestellansicht laedt Positionen und Zahlungen unter der Grenze nach", async () => {
  // Die Seitengroesse der Adminansicht ist zugleich die Laenge der Id-Liste,
  // mit der Positionen und Zahlungen nachgeladen werden. Wer sie anhebt, ohne
  // zu stueckeln, baut sich denselben Ausfall wie beim Sync.
  const { readFile } = await import("node:fs/promises");
  const quelle = await readFile(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8");
  const treffer = /const PAGE_SIZE = (\d+);/u.exec(quelle);
  assert.ok(treffer, "PAGE_SIZE nicht gefunden — der Test greift ins Leere");

  const seite = Number(treffer[1]);
  assert.ok(seite <= D1_SAFE_ID_LIST, `PAGE_SIZE ${seite} ueberschreitet die sichere Id-Listenlaenge ${D1_SAFE_ID_LIST}`);

  const ids = Array.from({ length: seite }, (_, i) => `order-${i}`);
  const { orderItems, payments } = await import("../db/schema.ts");
  for (const statement of [
    db.select().from(orderItems).where(inArray(orderItems.orderId, ids)),
    db.select().from(payments).where(inArray(payments.orderId, ids)),
  ]) {
    const used = params(statement);
    assert.ok(used <= D1_MAX_BOUND_PARAMS, `Nachladen bindet ${used} Parameter, Grenze ist ${D1_MAX_BOUND_PARAMS}`);
  }
});

test("die Admin-Bestellansicht paginiert und liefert die Gesamtseiten", async () => {
  const { readFile } = await import("node:fs/promises");
  const quelle = await readFile(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8");
  assert.match(quelle, /searchParams\.get\("page"\)/u, "die Seite muss aus der Anfrage gelesen werden");
  assert.match(quelle, /\.offset\(\(page - 1\) \* PAGE_SIZE\)/u, "die Datenbankabfrage muss die Seite überspringen");
  assert.match(quelle, /totalPages/u, "die Route muss die Gesamtseitenzahl zurückgeben");
});

test("Bestellungen lassen sich nur in fachlich erlaubte Versand- und Abschlussstatus setzen", async () => {
  const { readFile } = await import("node:fs/promises");
  const quelle = await readFile(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8");
  assert.match(quelle, /status: "SHIPPED"/u, "der Versandstatus muss gesetzt werden");
  assert.match(quelle, /inArray\(orders\.status, \[\.\.\.SHIPPABLE_STATUSES\]\)/u, "der Übergang muss serverseitig beschränkt sein");
  assert.match(quelle, /body\.status !== "SHIPPED" && body\.status !== "COMPLETED"/u, "andere Statuswechsel dürfen nicht durch die Route gehen");
  assert.match(quelle, /eq\(orders\.status, "SHIPPED"\)/u, "der Abschluss muss aus dem Versandstatus kommen");
});
