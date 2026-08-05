import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { ebayListings, inventory, products, syncEvents, syncRuns } from "../db/schema";
import { getAllInventoryItems, getOffersForSku, type EbayInventoryItem, type EbayOffer } from "./ebay-client";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const nestedText = (value: unknown, ...keys: string[]) => keys.reduce<unknown>((current, key) => record(current)[key], value) as unknown;

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

function mapListing(item: EbayInventoryItem, offer: EbayOffer) {
  const product = record(item.product);
  const listing = record(offer.listing);
  const title = text(product.title) ?? text(item.sku) ?? "eBay-Karte";
  const listingId = text(listing.listingId) ?? text((offer as Record<string, unknown>).listingId) ?? text(offer.offerId) ?? item.sku;
  if (!listingId) throw new Error("eBay-Angebot ohne stabile ID.");
  const quantity = Number(nestedText(item.availability, "shipToLocationAvailability", "quantity"));
  const imageUrls = Array.isArray(product.imageUrls) ? product.imageUrls.filter((value): value is string => typeof value === "string") : [];
  const description = text(listing.listingDescription) ?? text(product.description);
  const listingType = isAuction(offer) ? "AUCTION" : "FIXED_PRICE";
  return {
    ebayItemId: listingId,
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
  const db = getDb();
  const [run] = await db.insert(syncRuns).values({ source: "EBAY", status: "RUNNING" }).returning({ id: syncRuns.id });
  if (!run) throw new Error("eBay-Sync konnte nicht gestartet werden.");
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const seenItemIds = new Set<string>();

  try {
    const items = await getAllInventoryItems();
    for (const item of items) {
      if (!item.sku) { skippedCount++; continue; }
      const offers = await getOffersForSku(item.sku);
      for (const offer of offers) {
        let mapped;
        try { mapped = mapListing(item, offer); } catch (error) {
          skippedCount++;
          await db.insert(syncEvents).values({ syncRunId: run.id, status: "SKIPPED", message: error instanceof Error ? error.message : "Ungültiges eBay-Angebot." });
          continue;
        }
        seenItemIds.add(mapped.ebayItemId);
        const existing = await db.query.ebayListings.findFirst({ where: eq(ebayListings.ebayItemId, mapped.ebayItemId) });
        let productId = existing?.productId;
        if (productId) {
          await db.update(products).set({ title: mapped.title, description: mapped.description ?? null, status: "ACTIVE", updatedAt: new Date().toISOString() }).where(eq(products.id, productId));
          updatedCount++;
        } else {
          const [created] = await db.insert(products).values({ kind: "EBAY_SYNCED", status: "ACTIVE", title: mapped.title, description: mapped.description ?? null }).returning({ id: products.id });
          if (!created) throw new Error("Produkt konnte nicht angelegt werden.");
          productId = created.id;
          importedCount++;
        }
        const listingValues = {
          productId,
          ebayItemId: mapped.ebayItemId,
          sku: mapped.sku,
          title: mapped.title,
          descriptionHtml: mapped.description,
          priceAmountCents: mapped.priceAmountCents,
          priceCurrency: mapped.priceCurrency,
          quantity: mapped.quantity,
          listingType: mapped.listingType,
          listingUrl: mapped.listingUrl,
          rawData: mapped.rawData,
          status: "ACTIVE" as const,
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (existing) await db.update(ebayListings).set(listingValues).where(eq(ebayListings.id, existing.id));
        else await db.insert(ebayListings).values(listingValues);
        const existingInventory = await db.query.inventory.findFirst({ where: eq(inventory.productId, productId) });
        if (existingInventory) await db.update(inventory).set({ status: mapped.quantity > 0 ? "AVAILABLE" : "UNAVAILABLE", availableQuantity: mapped.quantity, updatedAt: new Date().toISOString() }).where(eq(inventory.id, existingInventory.id));
        else await db.insert(inventory).values({ productId, status: mapped.quantity > 0 ? "AVAILABLE" : "UNAVAILABLE", availableQuantity: mapped.quantity });
        await db.insert(syncEvents).values({ syncRunId: run.id, ebayItemId: mapped.ebayItemId, productId, status: existing ? "UPDATED" : "IMPORTED" });
      }
    }
    await db.update(syncRuns).set({ status: "SUCCEEDED", importedCount, updatedCount, failedCount: skippedCount, finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, run.id));
    return { runId: run.id, importedCount, updatedCount, skippedCount };
  } catch (error) {
    await db.update(syncRuns).set({ status: "FAILED", importedCount, updatedCount, failedCount: skippedCount + 1, errorMessage: error instanceof Error ? error.message : "Unbekannter eBay-Fehler.", finishedAt: new Date().toISOString() }).where(eq(syncRuns.id, run.id));
    throw error;
  }
}
