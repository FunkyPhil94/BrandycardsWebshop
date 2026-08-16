import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayListings, inventory, orderItems, orders, products } from "../../../db/schema";
import { classifyInventoryReviewRow } from "../inventory-review";
import { availableAssistantResult, type AssistantSaleItem, type AssistantToolDataMap, type AssistantToolInput, type AssistantToolResult } from "../contracts";
import { assistantTimestamp } from "../time";

const ACTIONABLE_ORDER_STATUSES = ["PAID", "PROCESSING"] as const;

export async function getLatestListing(): Promise<AssistantToolResult<"latest_listing">> {
  const [row] = await getDb().select({
    productId: products.id,
    title: products.title,
    origin: products.origin,
    productCreatedAt: products.createdAt,
    ebayItemId: ebayListings.ebayItemId,
    listingStartAt: ebayListings.startAt,
    priceAmountCents: ebayListings.priceAmountCents,
    productPriceAmountCents: products.priceAmountCents,
    priceCurrency: ebayListings.priceCurrency,
    productPriceCurrency: products.priceCurrency,
    listingUrl: ebayListings.listingUrl,
    lastSyncedAt: ebayListings.lastSyncedAt,
  }).from(products)
    .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
    .orderBy(desc(sql`datetime(COALESCE(${ebayListings.startAt}, ${products.createdAt}))`), desc(products.id))
    .limit(1);

  if (!row) return availableAssistantResult("latest_listing", { listing: null }, ["SHOP_DB", "EBAY_CACHE"]);
  const fromEbay = Boolean(row.ebayItemId);
  const listedAt = assistantTimestamp(row.listingStartAt ?? row.productCreatedAt);
  return availableAssistantResult("latest_listing", {
    listing: {
      source: fromEbay ? "EBAY" : "SHOP",
      productId: row.productId,
      title: row.title,
      listedAt,
      priceAmountCents: row.priceAmountCents ?? row.productPriceAmountCents,
      priceCurrency: row.priceCurrency ?? row.productPriceCurrency,
      listingUrl: row.listingUrl,
    },
  }, fromEbay ? ["SHOP_DB", "EBAY_CACHE"] : ["SHOP_DB"], assistantTimestamp(row.lastSyncedAt) ?? listedAt);
}

export async function listNewOrders(input: AssistantToolInput): Promise<AssistantToolResult<"new_orders">> {
  const db = getDb();
  const rows = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    status: orders.status,
    currency: orders.currency,
    totalAmountCents: orders.totalAmountCents,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
  }).from(orders)
    .where(and(inArray(orders.status, [...ACTIONABLE_ORDER_STATUSES]), isNotNull(orders.paidAt)))
    .orderBy(desc(sql`datetime(COALESCE(${orders.paidAt}, ${orders.createdAt}))`), desc(orders.id))
    .limit(input.limit);

  const ids = rows.map((row) => row.id);
  const itemRows = ids.length ? await db.select({
    orderId: orderItems.orderId,
    productId: orderItems.productId,
    title: orderItems.titleSnapshot,
    quantity: orderItems.quantity,
    amountCents: orderItems.totalAmountCents,
  }).from(orderItems).where(inArray(orderItems.orderId, ids)) : [];

  return availableAssistantResult("new_orders", {
    definition: "Neu bedeutet bezahlt und noch nicht versendet; unbezahlte Reservierungen und unbestätigte Zahlungen zählen nicht.",
    orders: rows.map((row) => ({
      ...row,
      createdAt: assistantTimestamp(row.createdAt),
      paidAt: assistantTimestamp(row.paidAt),
      items: itemRows.filter((item) => item.orderId === row.id).map((item): AssistantSaleItem => ({
        productId: item.productId,
        title: item.title,
        quantity: item.quantity,
        amountCents: item.amountCents,
        currency: row.currency,
      })),
    })),
  }, ["SHOP_DB"], assistantTimestamp(rows[0]?.paidAt ?? rows[0]?.createdAt ?? null));
}

export async function getInventoryReview(input: AssistantToolInput): Promise<AssistantToolResult<"inventory_review">> {
  const db = getDb();
  const [rows, [freshnessRow]] = await Promise.all([db.select({
    productId: products.id,
    title: products.title,
    kind: products.kind,
    origin: products.origin,
    productStatus: products.status,
    listingStatus: ebayListings.status,
    listingQuantity: ebayListings.quantity,
    lastSyncedAt: ebayListings.lastSyncedAt,
    inventoryStatus: inventory.status,
    availableQuantity: inventory.availableQuantity,
  }).from(products)
    .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id)),
  db.select({ value: sql<string | null>`max(datetime(${ebayListings.lastSyncedAt}))` }).from(ebayListings)]);

  type InventoryIssue = AssistantToolDataMap["inventory_review"]["items"][number];
  const issues: InventoryIssue[] = [];
  for (const row of rows) {
    const common = {
      productId: row.productId,
      title: row.title,
      availableQuantity: row.availableQuantity,
      listingQuantity: row.listingQuantity,
      lastSyncedAt: assistantTimestamp(row.lastSyncedAt),
    };
    const classification = classifyInventoryReviewRow(row);
    if (classification) issues.push({ ...common, ...classification });
  }

  issues.sort((left, right) => left.attention.localeCompare(right.attention)
    || left.reasonCode.localeCompare(right.reasonCode)
    || left.title.localeCompare(right.title, "de")
    || left.productId.localeCompare(right.productId));
  const freshness = assistantTimestamp(freshnessRow?.value ?? null);
  return availableAssistantResult("inventory_review", {
    definition: "Nachfüllen gilt für manuelle Karten ohne verfügbaren Bestand; Prüfen gilt für widersprüchliche Shop-, Listing- oder Bestandsstände.",
    items: issues.slice(0, input.limit),
  }, ["SHOP_DB", "EBAY_CACHE"], freshness);
}
