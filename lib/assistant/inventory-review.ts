export type InventoryReviewRow = {
  productId: string;
  title: string;
  kind: string;
  origin: string;
  productStatus: string;
  listingStatus: string | null;
  listingQuantity: number | null;
  lastSyncedAt: string | null;
  inventoryStatus: string | null;
  availableQuantity: number | null;
};

export type InventoryReviewClassification = null | {
  attention: "REFILL" | "CHECK";
  reasonCode: string;
};

/** Reine Fachentscheidung, damit Reservierungen und Altbestand testbar bleiben. */
export function classifyInventoryReviewRow(row: InventoryReviewRow): InventoryReviewClassification {
  if (row.origin === "MANUAL") {
    if (row.productStatus !== "ACTIVE" || row.inventoryStatus === "RESERVED") return null;
    if (row.availableQuantity === null || row.availableQuantity <= 0 || row.inventoryStatus === "SOLD" || row.inventoryStatus === "UNAVAILABLE") {
      return { attention: "REFILL", reasonCode: "MANUAL_STOCK_EMPTY" };
    }
    return null;
  }
  if (row.origin !== "EBAY") return null;
  if (row.kind === "EBAY_SYNCED" && row.productStatus === "ACTIVE" && row.listingStatus !== "ACTIVE") {
    return { attention: "CHECK", reasonCode: "ACTIVE_PRODUCT_WITHOUT_ACTIVE_LISTING" };
  }
  if (row.listingStatus === "ACTIVE" && row.productStatus !== "ACTIVE") {
    return { attention: "CHECK", reasonCode: "ACTIVE_LISTING_WITHOUT_ACTIVE_PRODUCT" };
  }
  if (row.listingStatus === "ACTIVE" && row.availableQuantity === null) {
    return { attention: "CHECK", reasonCode: "MISSING_INVENTORY" };
  }
  if (row.listingStatus === "ACTIVE" && row.inventoryStatus !== "RESERVED" && row.availableQuantity !== null && row.listingQuantity !== null && row.availableQuantity !== row.listingQuantity) {
    return { attention: "CHECK", reasonCode: "LISTING_INVENTORY_QUANTITY_MISMATCH" };
  }
  return null;
}
