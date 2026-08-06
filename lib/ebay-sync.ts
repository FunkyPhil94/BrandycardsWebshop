import { eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import { ebayListings, inventory, productAssets, products, syncEvents, syncRuns } from "../db/schema";
import { getActiveEbayListings, type EbayActiveListing } from "./ebay-client";

let localSyncLock: Promise<unknown> | null = null;
const newEntityId = () => crypto.randomUUID().replaceAll("-", "");

function mapActiveListing(listing: EbayActiveListing) {
  return {
    ebayItemId: listing.ebayItemId,
    // GetMyeBaySelling returns no Inventory API offerId. Until the write path
    // switches to the Trading API `EndItem`, this stays NULL and the eBay
    // withdraw outbox never receives a job. See docs/ai-agent-log.md.
    ebayOfferId: null,
    sku: listing.sku,
    title: listing.title,
    description: listing.description,
    imageUrls: listing.imageUrls,
    listingType: listing.listingType,
    listingUrl: listing.listingUrl,
    priceAmountCents: listing.priceAmountCents,
    priceCurrency: listing.priceCurrency,
    quantity: listing.quantity,
    rawData: listing.rawData,
  };
}

export async function runEbaySync() {
  if (localSyncLock) throw new Error("eBay-Synchronisierung läuft bereits.");
  const task = runEbaySyncInternal();
  localSyncLock = task;
  try { return await task; } finally { localSyncLock = null; }
}

async function runEbaySyncInternal() {
  const db = getDb();
  const staleBefore = new Date(Date.now() - 30 * 60_000).toISOString();
  const activeRuns = await db.query.syncRuns.findMany({ where: eq(syncRuns.status, "RUNNING"), limit: 20 });
  for (const activeRun of activeRuns) {
    if (activeRun.source === "EBAY" && activeRun.startedAt < staleBefore) {
      await db.update(syncRuns).set({ status: "FAILED", finishedAt: new Date().toISOString(), errorMessage: "Veralteter Sync-Lauf automatisch geschlossen." }).where(eq(syncRuns.id, activeRun.id));
    }
  }
  const run = await env.DB.prepare(`
    INSERT INTO sync_runs (id, source, status, started_at, imported_count, updated_count, deactivated_count, failed_count)
    SELECT lower(hex(randomblob(16))), 'EBAY', 'RUNNING', CURRENT_TIMESTAMP, 0, 0, 0, 0
    WHERE NOT EXISTS (SELECT 1 FROM sync_runs WHERE source = 'EBAY' AND status = 'RUNNING')
    RETURNING id
  `).first<{ id: string }>();
  if (!run) throw new Error("eBay-Synchronisierung läuft bereits.");

  let importedCount = 0;
  let updatedCount = 0;
  let deactivatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const seenItemIds = new Set<string>();

  const finalizeRun = async (values: Partial<typeof syncRuns.$inferInsert>) => {
    try {
      await db.update(syncRuns).set(values).where(eq(syncRuns.id, run.id));
    } catch (finalizeError) {
      console.error("eBay sync run finalization failed", finalizeError);
    }
  };

  try {
    // GetMyeBaySelling is the authoritative source for listings that are
    // actually live in the seller account. It also avoids Inventory API
    // offers that were created but never published.
    const listings = await getActiveEbayListings();
    const existingListingRows = await db.select({
      id: ebayListings.id,
      ebayItemId: ebayListings.ebayItemId,
      productId: ebayListings.productId,
    }).from(ebayListings);
    const existingListingsByItemId = new Map(existingListingRows.map((row) => [row.ebayItemId, row]));
    const inventoryRows = await db.select({ id: inventory.id, productId: inventory.productId }).from(inventory);
    const inventoryByProductId = new Map(inventoryRows.map((row) => [row.productId, row]));

    for (const listing of listings) {
      const mapped = mapActiveListing(listing);
      if (seenItemIds.has(mapped.ebayItemId)) {
        skippedCount++;
        continue;
      }
      try {
        const existing = existingListingsByItemId.get(mapped.ebayItemId);
        const isNewProduct = !existing?.productId;
        const productId = existing?.productId ?? newEntityId();
        const now = new Date().toISOString();
        const listingStatus: "ACTIVE" | "ENDED" = mapped.quantity > 0 ? "ACTIVE" : "ENDED";
        const listingValues = {
          productId,
          ebayItemId: mapped.ebayItemId,
          ebayOfferId: mapped.ebayOfferId,
          sku: mapped.sku,
          title: mapped.title,
          descriptionHtml: mapped.description,
          priceAmountCents: mapped.priceAmountCents,
          priceCurrency: mapped.priceCurrency,
          quantity: mapped.quantity,
          listingType: mapped.listingType,
          listingUrl: mapped.listingUrl,
          rawData: mapped.rawData,
          status: listingStatus,
          lastSyncedAt: now,
          updatedAt: now,
        };
        const statements: BatchItem<"sqlite">[] = [];
        if (isNewProduct) statements.push(db.insert(products).values({ id: productId, kind: "EBAY_SYNCED", status: "ACTIVE", title: mapped.title, description: mapped.description ?? null, createdAt: now, updatedAt: now }));
        else statements.push(db.update(products).set({ title: mapped.title, description: mapped.description ?? null, status: mapped.quantity > 0 ? "ACTIVE" : "INACTIVE", updatedAt: now }).where(eq(products.id, productId)));
        if (existing) statements.push(db.update(ebayListings).set(listingValues).where(eq(ebayListings.id, existing.id)));
        else statements.push(db.insert(ebayListings).values(listingValues));
        statements.push(db.delete(productAssets).where(eq(productAssets.productId, productId)));
        if (mapped.imageUrls.length) statements.push(db.insert(productAssets).values(mapped.imageUrls.map((sourceUrl, sortOrder) => ({ productId, storageKey: `ebay/${mapped.ebayItemId}/${sortOrder}`, sourceUrl, mimeType: "image/*", sortOrder, isPublic: true }))));
        const existingInventory = inventoryByProductId.get(productId);
        if (existingInventory) statements.push(db.update(inventory).set({ status: mapped.quantity > 0 ? "AVAILABLE" : "UNAVAILABLE", availableQuantity: mapped.quantity, updatedAt: now }).where(eq(inventory.id, existingInventory.id)));
        else statements.push(db.insert(inventory).values({ productId, status: mapped.quantity > 0 ? "AVAILABLE" : "UNAVAILABLE", availableQuantity: mapped.quantity, updatedAt: now }));
        statements.push(db.insert(syncEvents).values({ syncRunId: run.id, ebayItemId: mapped.ebayItemId, productId, status: existing ? "UPDATED" : "IMPORTED", createdAt: now }));
        await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
        seenItemIds.add(mapped.ebayItemId);
        if (isNewProduct) importedCount++; else updatedCount++;
      } catch (error) {
        skippedCount++;
        failedCount++;
        console.error("eBay listing write failed", mapped.ebayItemId, error);
      }
    }

    // A partial import must never deactivate older products. Deactivation is
    // only safe after every active eBay listing was written successfully.
    if (failedCount > 0) {
      throw new Error(`${failedCount} eBay-Angebote konnten nicht gespeichert werden; keine Deaktivierungen durchgeführt.`);
    }

    const activeListingResult = await env.DB.prepare(`
      SELECT id, ebay_item_id AS ebayItemId, product_id AS productId
      FROM ebay_listings
      WHERE status = ?
    `).bind("ACTIVE").all<{ id: string; ebayItemId: string; productId: string }>();
    // A corrected import can retire a large backlog at once. Row-by-row writes
    // would be four round trips per listing, so deactivation runs in batches.
    const stale = activeListingResult.results.filter((listing) => !seenItemIds.has(listing.ebayItemId));
    for (let offset = 0; offset < stale.length; offset += 50) {
      const chunk = stale.slice(offset, offset + 50);
      const now = new Date().toISOString();
      const listingIds = chunk.map((listing) => listing.id);
      const productIds = chunk.map((listing) => listing.productId);
      await db.batch([
        db.update(ebayListings).set({ status: "ENDED", updatedAt: now }).where(inArray(ebayListings.id, listingIds)),
        db.update(products).set({ status: "INACTIVE", updatedAt: now }).where(inArray(products.id, productIds)),
        db.update(inventory).set({ status: "UNAVAILABLE", availableQuantity: 0, updatedAt: now }).where(inArray(inventory.productId, productIds)),
        db.insert(syncEvents).values(chunk.map((listing) => ({ syncRunId: run.id, ebayItemId: listing.ebayItemId, productId: listing.productId, status: "DEACTIVATED" as const, message: "Angebot nicht mehr in eBay-Aktivliste vorhanden.", createdAt: now }))),
      ]);
      deactivatedCount += chunk.length;
    }
    await finalizeRun({ status: skippedCount ? "PARTIAL" : "SUCCEEDED", importedCount, updatedCount, deactivatedCount, failedCount, finishedAt: new Date().toISOString(), errorMessage: null });
    return { runId: run.id, importedCount, updatedCount, deactivatedCount, skippedCount };
  } catch (error) {
    await finalizeRun({ status: "FAILED", importedCount, updatedCount, failedCount: Math.max(1, failedCount), errorMessage: error instanceof Error ? error.message : "Unbekannter eBay-Fehler.", finishedAt: new Date().toISOString() });
    throw error;
  }
}
