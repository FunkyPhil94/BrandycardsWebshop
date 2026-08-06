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
