import { asc, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import { ebayListings, inventory, productAssets, products, syncEvents, syncRuns } from "../db/schema";
import { getActiveEbayListings, type EbayActiveListing } from "./ebay-client";
import { bilderStehenSchonSo, stehtSchonSo } from "./ebay-sync-diff";
import { D1_SAFE_ID_LIST, maxInsertRows } from "./d1-limits";
import { ExpiringLock, isSyncRunStale, SYNC_RUN_DEADLINE_MS, withDeadline } from "./sync-lock";

/** syncRunId, ebayItemId, productId, status, message, createdAt */
const SYNC_EVENT_INSERT_COLUMNS = 6;

const syncLock = new ExpiringLock();
const newEntityId = () => crypto.randomUUID().replaceAll("-", "");

function mapActiveListing(listing: EbayActiveListing) {
  return {
    ebayItemId: listing.ebayItemId,
    // GetMyeBaySelling returns no Inventory API offerId, so this stays NULL.
    // That no longer blocks the write path: the outbox addresses listings by
    // ItemID and revises the quantity via the Trading API. See lib/ebay-outbox.ts.
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
    startAt: listing.startAt,
    endAt: listing.endAt,
    rawData: listing.rawData,
  };
}

/** Gibt `sync_runs`-Zeilen frei, die kein lebender Lauf mehr halten kann.
 *
 * Steht bewusst als eigene Funktion da, weil sie **vor** der Sperrprüfung
 * laufen muss. Früher stand sie hinter ihr, mitten im Lauf — und wurde damit
 * in genau dem Fall nie erreicht, für den sie gebaut war: Sperre verklemmt,
 * jeder weitere Aufruf fliegt vorher heraus, niemand räumt auf. Am 2026-08-07
 * musste deshalb eine `RUNNING`-Zeile von Hand freigegeben werden.
 */
async function releaseStaleSyncRuns() {
  const db = getDb();
  const now = new Date();
  const activeRuns = await db.query.syncRuns.findMany({ where: eq(syncRuns.status, "RUNNING"), limit: 20 });
  for (const activeRun of activeRuns) {
    if (activeRun.source === "EBAY" && isSyncRunStale(activeRun.startedAt, now)) {
      await db.update(syncRuns).set({ status: "FAILED", finishedAt: now.toISOString(), errorMessage: "Veralteter Sync-Lauf automatisch geschlossen." }).where(eq(syncRuns.id, activeRun.id));
    }
  }
}

export async function runEbaySync() {
  // Reihenfolge ist hier die eigentliche Korrektur: erst aufräumen, dann
  // sperren. Ein abgestürzter Vorgänger wird so vom nächsten Cron-Schlag
  // eingesammelt, statt auf einen Eingriff von Hand zu warten.
  await releaseStaleSyncRuns();
  if (!syncLock.tryAcquire()) throw new Error("eBay-Synchronisierung läuft bereits.");
  try {
    return await withDeadline(
      runEbaySyncInternal(),
      SYNC_RUN_DEADLINE_MS,
      "eBay-Synchronisierung hat die Zeitgrenze überschritten und wurde abgebrochen.",
    );
  } finally {
    syncLock.release();
  }
}

async function runEbaySyncInternal() {
  const db = getDb();
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
  // Getrennt von `skippedCount` zu halten ist wichtig: Der entscheidet über
  // `PARTIAL`, und ein unverändertes Listing ist kein halber Lauf, sondern der
  // Normalfall.
  let unchangedCount = 0;
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
    // Gelesen wird jetzt der ganze Vergleichsstand, nicht mehr nur drei
    // Spalten. Das kostet Lesevorgänge — und spart ein Vielfaches davon an
    // Schreibvorgängen, die ohne den Vergleich nur dasselbe noch einmal
    // hinschreiben. Vier gebündelte Abfragen statt vier je Listing.
    const existingListingRows = await db.select({
      id: ebayListings.id,
      ebayItemId: ebayListings.ebayItemId,
      productId: ebayListings.productId,
      ebayOfferId: ebayListings.ebayOfferId,
      sku: ebayListings.sku,
      title: ebayListings.title,
      priceAmountCents: ebayListings.priceAmountCents,
      priceCurrency: ebayListings.priceCurrency,
      quantity: ebayListings.quantity,
      listingType: ebayListings.listingType,
      listingUrl: ebayListings.listingUrl,
      startAt: ebayListings.startAt,
      endAt: ebayListings.endAt,
      rawData: ebayListings.rawData,
      status: ebayListings.status,
    }).from(ebayListings);
    const existingListingsByItemId = new Map(existingListingRows.map((row) => [row.ebayItemId, row]));
    const productRows = await db.select({
      id: products.id, title: products.title, description: products.description, status: products.status,
    }).from(products);
    const productsById = new Map(productRows.map((row) => [row.id, row]));
    const assetRows = await db.select({
      productId: productAssets.productId, sourceUrl: productAssets.sourceUrl,
    }).from(productAssets).orderBy(asc(productAssets.productId), asc(productAssets.sortOrder));
    const assetUrlsByProductId = new Map<string, (string | null)[]>();
    for (const row of assetRows) {
      const bilder = assetUrlsByProductId.get(row.productId);
      if (bilder) bilder.push(row.sourceUrl);
      else assetUrlsByProductId.set(row.productId, [row.sourceUrl]);
    }
    const inventoryRows = await db.select({
      id: inventory.id, productId: inventory.productId,
      status: inventory.status, availableQuantity: inventory.availableQuantity,
    }).from(inventory);
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
          startAt: mapped.startAt,
          endAt: mapped.endAt,
          rawData: mapped.rawData,
          status: listingStatus,
          lastSyncedAt: now,
          updatedAt: now,
        };
        // Jede Anweisung wird einzeln daraufhin geprüft, ob sie etwas bewirkt.
        // Bleibt die Liste leer, entfällt der Batch vollständig — und damit
        // der ganze Schreibvorgang für dieses Listing.
        const statements: BatchItem<"sqlite">[] = [];
        const productValues = { title: mapped.title, description: mapped.description ?? null, status: (mapped.quantity > 0 ? "ACTIVE" : "INACTIVE") as "ACTIVE" | "INACTIVE", updatedAt: now };
        if (isNewProduct) statements.push(db.insert(products).values({ id: productId, kind: "EBAY_SYNCED", ...productValues, status: "ACTIVE", createdAt: now }));
        else if (!stehtSchonSo(productsById.get(productId), productValues)) statements.push(db.update(products).set(productValues).where(eq(products.id, productId)));
        if (!existing) statements.push(db.insert(ebayListings).values(listingValues));
        else if (!stehtSchonSo(existing, listingValues)) statements.push(db.update(ebayListings).set(listingValues).where(eq(ebayListings.id, existing.id)));
        // Bilder werden nur angefasst, wenn sich die Liste wirklich
        // unterscheidet. Das blinde Löschen-und-Einfügen war der teuerste
        // Einzelposten des Laufs, ohne je etwas zu ändern.
        if (!bilderStehenSchonSo(assetUrlsByProductId.get(productId) ?? [], mapped.imageUrls)) {
          statements.push(db.delete(productAssets).where(eq(productAssets.productId, productId)));
          if (mapped.imageUrls.length) statements.push(db.insert(productAssets).values(mapped.imageUrls.map((sourceUrl, sortOrder) => ({ productId, storageKey: `ebay/${mapped.ebayItemId}/${sortOrder}`, sourceUrl, mimeType: "image/*", sortOrder, isPublic: true }))));
        }
        const existingInventory = inventoryByProductId.get(productId);
        const inventoryValues = { status: (mapped.quantity > 0 ? "AVAILABLE" : "UNAVAILABLE") as "AVAILABLE" | "UNAVAILABLE", availableQuantity: mapped.quantity, updatedAt: now };
        if (!existingInventory) statements.push(db.insert(inventory).values({ productId, ...inventoryValues }));
        else if (!stehtSchonSo(existingInventory, inventoryValues)) statements.push(db.update(inventory).set(inventoryValues).where(eq(inventory.id, existingInventory.id)));
        // `sync_events` nur bei einem Ereignis, das etwas aussagt. Ein
        // „UPDATED" für ein unverändertes Listing war der größte Einzelposten
        // überhaupt (~31 700 Zeilen in 24 Stunden) und ließ die Tabelle um
        // ~42 000 Zeilen am Tag wachsen, ohne je eine Frage zu beantworten.
        // Bei einer **echten** Änderung bleibt der Eintrag: Dann ist er die
        // Spur, an der sich nachvollziehen lässt, wann sie kam.
        //
        // Die Frage „hat sich etwas geändert?" muss **vor** diesem Eintrag
        // beantwortet werden — danach ist die Liste immer gefüllt.
        const hatAenderungen = statements.length > 0;
        if (hatAenderungen) statements.push(db.insert(syncEvents).values({ syncRunId: run.id, ebayItemId: mapped.ebayItemId, productId, status: existing ? "UPDATED" : "IMPORTED", createdAt: now }));
        if (statements.length) await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
        seenItemIds.add(mapped.ebayItemId);
        if (isNewProduct) importedCount++;
        else if (hatAenderungen) updatedCount++;
        else unchangedCount++;
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
    // Chunk sizes come from the D1 parameter ceiling, see lib/d1-limits.ts.
    const DEACTIVATE_CHUNK = D1_SAFE_ID_LIST;
    const EVENT_CHUNK = maxInsertRows(SYNC_EVENT_INSERT_COLUMNS);
    const stale = activeListingResult.results.filter((listing) => !seenItemIds.has(listing.ebayItemId));
    for (let offset = 0; offset < stale.length; offset += DEACTIVATE_CHUNK) {
      const chunk = stale.slice(offset, offset + DEACTIVATE_CHUNK);
      const now = new Date().toISOString();
      const listingIds = chunk.map((listing) => listing.id);
      const productIds = chunk.map((listing) => listing.productId);
      const eventInserts: BatchItem<"sqlite">[] = [];
      for (let eventOffset = 0; eventOffset < chunk.length; eventOffset += EVENT_CHUNK) {
        eventInserts.push(db.insert(syncEvents).values(chunk.slice(eventOffset, eventOffset + EVENT_CHUNK).map((listing) => ({
          syncRunId: run.id, ebayItemId: listing.ebayItemId, productId: listing.productId,
          status: "DEACTIVATED" as const, message: "Angebot nicht mehr in eBay-Aktivliste vorhanden.", createdAt: now,
        }))));
      }
      await db.batch([
        db.update(ebayListings).set({ status: "ENDED", updatedAt: now }).where(inArray(ebayListings.id, listingIds)),
        db.update(products).set({ status: "INACTIVE", updatedAt: now }).where(inArray(products.id, productIds)),
        db.update(inventory).set({ status: "UNAVAILABLE", availableQuantity: 0, updatedAt: now }).where(inArray(inventory.productId, productIds)),
        ...eventInserts,
      ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
      deactivatedCount += chunk.length;
    }

    // The sweep above is driven by ebay_listings, so it cannot see a product
    // that has no listing row at all. Those orphans appear when a run writes
    // the product but not the listing - which happened during earlier failed
    // runs, before both writes shared one batch. They stay invisible to the
    // storefront but keep counting as active stock, so retire them here.
    const orphanNow = new Date().toISOString();
    const orphanResult = await env.DB.prepare(`
      UPDATE products SET status = 'INACTIVE', updated_at = ?
      WHERE kind = 'EBAY_SYNCED' AND status = 'ACTIVE'
        AND id NOT IN (SELECT product_id FROM ebay_listings WHERE status = 'ACTIVE')
    `).bind(orphanNow).run();
    const orphanCount = orphanResult.meta.changes ?? 0;
    if (orphanCount > 0) {
      await env.DB.prepare(`
        UPDATE inventory SET status = 'UNAVAILABLE', available_quantity = 0, updated_at = ?
        WHERE product_id IN (SELECT id FROM products WHERE kind = 'EBAY_SYNCED' AND status = 'INACTIVE')
          AND status <> 'UNAVAILABLE'
      `).bind(orphanNow).run();
      console.warn("[ebay-sync] Produkte ohne aktives Listing deaktiviert.", { orphanCount });
      deactivatedCount += orphanCount;
    }

    await finalizeRun({ status: skippedCount ? "PARTIAL" : "SUCCEEDED", importedCount, updatedCount, deactivatedCount, failedCount, finishedAt: new Date().toISOString(), errorMessage: null });
    // `unchangedCount` geht bewusst **nicht** in `sync_runs`: Dafür bräuchte es
    // eine Spalte, also eine Migration, und die ist rücksprachepflichtig.
    // `updated_count` zählt dort künftig nur noch echte Änderungen — ein
    // ruhiger Lauf meldet 0 statt 294. Das ist der Zweck, sieht in der
    // Laufübersicht aber nach „nichts passiert" aus; die Zahl daneben in der
    // Adminfläche ordnet es ein.
    return { runId: run.id, importedCount, updatedCount, deactivatedCount, skippedCount, unchangedCount };
  } catch (error) {
    await finalizeRun({ status: "FAILED", importedCount, updatedCount, failedCount: Math.max(1, failedCount), errorMessage: error instanceof Error ? error.message : "Unbekannter eBay-Fehler.", finishedAt: new Date().toISOString() });
    throw error;
  }
}
