import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import { ebayListings, inventory, productAssets, products, syncEvents, syncRuns } from "../db/schema";
import { getAllInventoryItems, getOffersForSku, type EbayInventoryItem, type EbayOffer } from "./ebay-client";

let localSyncLock: Promise<unknown> | null = null;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const nestedText = (value: unknown, ...keys: string[]) => keys.reduce<unknown>((current, key) => record(current)[key], value) as unknown;

/* Legacy Inventory API mapping retained only for historical data compatibility. */
function priceCents(offer: EbayOffer) {
  const price = record(offer.pricingSummary).price;
  const value = Number(record(price).value);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

function isAuction(offer: EbayOffer) {
  const duration = text(offer.listingDuration)?.toUpperCase() ?? "";
  const listingType = text(record(offer.listing).listingType)?.toUpperCase() ?? "";
  return listingType.includes("AUCTION") || duration.startsWith("DAYS_");
}

/**
 * Inventory items also contain unpublished offers created through the API.
 * Only a published offer with an active eBay listing belongs in the shop.
 */
function isPublishedActiveOffer(offer: EbayOffer) {
  const offerStatus = text(offer.status)?.toUpperCase();
  const listingStatus = text(record(offer.listing).listingStatus)?.toUpperCase();
  return offerStatus === "PUBLISHED" && listingStatus === "ACTIVE";
}

function mapLegacyListing(item: EbayInventoryItem, offer: EbayOffer) {
  const product = record(item.product);
  const listing = record(offer.listing);
  const title = text(product.title) ?? text(item.sku) ?? "eBay-Karte";
  const listingId = text(listing.listingId) ?? text((offer as Record<string, unknown>).listingId) ?? text(offer.offerId) ?? item.sku;
  const offerId = text(offer.offerId);
  if (!listingId) throw new Error("eBay-Angebot ohne stabile ID.");
  const quantity = Number(nestedText(item.availability, "shipToLocationAvailability", "quantity"));
  const imageUrls = Array.isArray(product.imageUrls) ? product.imageUrls.filter((value): value is string => typeof value === "string") : [];
  const description = text(listing.listingDescription) ?? text(product.description);
  const listingType = isAuction(offer) ? "AUCTION" : "FIXED_PRICE";
  return {
    ebayItemId: listingId,
    ebayOfferId: offerId,
    sku: text(item.sku),
    title,
    description,
    imageUrls,
    listingType,
    listingUrl: text(listing.listingUrl) ?? `https://www.ebay.de/itm/${listingId}`,
    priceAmountCents: priceCents(offer),
    priceCurrency: text(record(offer.pricingSummary).priceCurrency) ?? "EUR",
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
    rawData: { item, offer },
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
  const seenItemIds = new Set<string>();

  try {
    const items = await getAllInventoryItems();
    for (const item of items) {
      if (!item.sku) { skippedCount++; continue; }
      const offers = await getOffersForSku(item.sku);
      for (const offer of offers) {
        if (!isPublishedActiveOffer(offer)) {
          skippedCount++;
          await db.insert(syncEvents).values({
            syncRunId: run.id,
            ebayItemId: text(record(offer.listing).listingId) ?? text(offer.offerId),
            status: "SKIPPED",
            message: "Unveröffentlichtes oder nicht aktives eBay-Angebot nicht importiert.",
          });
          continue;
        }
        let mapped;
        try { mapped = mapLegacyListing(item, offer); } catch (error) {
          skippedCount++;
          await db.insert(syncEvents).values({ syncRunId: run.id, status: "SKIPPED", message: error instanceof Error ? error.message : "Ungültiges eBay-Angebot." });
          continue;
        }
        if (seenItemIds.has(mapped.ebayItemId)) {
          skippedCount++;
          await db.insert(syncEvents).values({
            syncRunId: run.id,
            ebayItemId: mapped.ebayItemId,
            status: "SKIPPED",
            message: "Doppeltes eBay-Listing innerhalb des Sync-Laufs nicht erneut importiert.",
          });
          continue;
        }
        seenItemIds.add(mapped.ebayItemId);
        const existing = await db.query.ebayListings.findFirst({ where: eq(ebayListings.ebayItemId, mapped.ebayItemId) });
        let productId = existing?.productId;
        if (productId) {
          await db.update(products).set({ title: mapped.title, description: mapped.description ?? null, status: mapped.quantity > 0 ? "ACTIVE" : "INACTIVE", updatedAt: new Date().toISOString() }).where(eq(products.id, productId));
          updatedCount++;
        } else {
          const [created] = await db.insert(products).values({ kind: "EBAY_SYNCED", status: "ACTIVE", title: mapped.title, description: mapped.description ?? null }).returning({ id: products.id });
          if (!created) throw new Error("Produkt konnte nicht angelegt werden.");
          productId = created.id;
          importedCount++;
        }
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
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (existing) await db.update(ebayListings).set(listingValues).where(eq(ebayListings.id, existing.id));
        else await db.insert(ebayListings).values(listingValues);
        await db.delete(productAssets).where(eq(productAssets.productId, productId));
        if (mapped.imageUrls.length) {
          await db.insert(productAssets).values(mapped.imageUrls.map((sourceUrl, sortOrder) => ({
            productId,
            storageKey: `ebay/${mapped.ebayItemId}/${sortOrder}`,
            sourceUrl,
            mimeType: "image/*",
            sortOrder,
            isPublic: true,
          })));
        }
        const existingInventory = await db.query.inventory.findFirst({ where: eq(inventory.productId, productId) });
        if (existingInventory) await db.update(inventory).set({ status: mapped.quantity > 0 ? "AVAILABLE" : "UNAVAILABLE", availableQuantity: mapped.quantity, updatedAt: new Date().toISOString() }).where(eq(inventory.id, existingInventory.id));
        else await db.insert(inventory).values({ productId, status: mapped.quantity > 0 ? "AVAILABLE" : "UNAVAILABLE", availableQuantity: mapped.quantity });
        await db.insert(syncEvents).values({ syncRunId: run.id, ebayItemId: mapped.ebayItemId, productId, status: existing ? "UPDATED" : "IMPORTED" });
      }
    }
    const activeListings = await db.select({ id: ebayListings.id, ebayItemId: ebayListings.ebayItemId, productId: ebayListings.productId }).from(ebayListings).where(eq(ebayListings.status, "ACTIVE"));
    for (const listing of activeListings) {
      if (seenItemIds.has(listing.ebayItemId)) continue;
      await db.update(ebayListings).set({ status: "ENDED", updatedAt: new Date().toISOString() }).where(eq(ebayListings.id, listing.id));
      await db.update(products).set({ status: "INACTIVE", updatedAt: new Date().toISOString() }).where(eq(products.id, listing.productId));
      await db.update(inventory).set({ status: "UNAVAILABLE", availableQuantity: 0, updatedAt: new Date().toISOString() }).where(eq(inventory.productId, listing.productId));
      await db.insert(syncEvents).values({ syncRunId: run.id, ebayItemId: listing.ebayItemId, productId: listing.productId, status: "DEACTIVATED", message: "Angebot nicht mehr in eBay-Inventar vorhanden." });
      deactivatedCount++;
    }
    await db.update(syncRuns).set({ status: skippedCount ? "PARTIAL" : "SUCCEEDED", importedCount, updatedCount, deactivatedCount, failedCount: skippedCount, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, run.id));
    return { runId: run.id, importedCount, updatedCount, deactivatedCount, skippedCount };
  } catch (error) {
    await db.update(syncRuns).set({ status: "FAILED", importedCount, updatedCount, failedCount: skippedCount + 1, errorMessage: error instanceof Error ? error.message : "Unbekannter eBay-Fehler.", finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, run.id));
    throw error;
  }
}
