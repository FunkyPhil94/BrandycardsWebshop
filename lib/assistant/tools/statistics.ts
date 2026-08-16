import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayListings, ebayOutbox, inquiries, inventory, orders, priceOffers, products, syncRuns } from "../../../db/schema";
import { istKaufbar } from "../../catalog-availability";
import { availableAssistantResult, type AssistantToolResult } from "../contracts";
import { assistantTimestamp } from "../time";

const OPEN_SHOP_OFFER_STATUSES = ["NEW", "IN_REVIEW"] as const;
const ACTIONABLE_ORDER_STATUSES = ["PAID", "PROCESSING"] as const;
const UNRESOLVED_OUTBOX_STATUSES = ["PENDING", "PROCESSING", "RETRY_WAIT", "FAILED"] as const;

export async function getAssistantStatistics(): Promise<AssistantToolResult<"assistant_statistics">> {
  const db = getDb();
  const [catalogRows, [offerCount], [orderCount], [inquiryCount], [outboxCount], [latestSync]] = await Promise.all([
    db.select({
      kind: products.kind,
      origin: products.origin,
      listingType: ebayListings.listingType,
      listingQuantity: ebayListings.quantity,
      inventoryStatus: inventory.status,
      availableQuantity: inventory.availableQuantity,
    }).from(products)
      .leftJoin(ebayListings, and(eq(ebayListings.productId, products.id), eq(ebayListings.status, "ACTIVE")))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(eq(products.status, "ACTIVE")),
    db.select({ value: count() }).from(priceOffers).where(inArray(priceOffers.status, [...OPEN_SHOP_OFFER_STATUSES])),
    db.select({ value: count() }).from(orders).where(and(inArray(orders.status, [...ACTIONABLE_ORDER_STATUSES]), isNotNull(orders.paidAt))),
    db.select({ value: count() }).from(inquiries).where(eq(inquiries.status, "NEW")),
    db.select({ value: count() }).from(ebayOutbox).where(inArray(ebayOutbox.status, [...UNRESOLVED_OUTBOX_STATUSES])),
    db.select({ id: syncRuns.id, status: syncRuns.status, startedAt: syncRuns.startedAt, finishedAt: syncRuns.finishedAt })
      .from(syncRuns).orderBy(sql`datetime(${syncRuns.startedAt}) DESC`, sql`${syncRuns.id} DESC`).limit(1),
  ]);

  const sellableCards = catalogRows.filter((row) => istKaufbar(
    row.kind,
    row.listingType,
    row.listingQuantity,
    row.inventoryStatus === null ? null : { status: row.inventoryStatus, availableQuantity: row.availableQuantity ?? 0 },
    row.origin,
  )).length;
  const latestEbaySyncAt = assistantTimestamp(latestSync?.finishedAt ?? latestSync?.startedAt ?? null);

  return availableAssistantResult("assistant_statistics", {
    generatedAt: new Date().toISOString(),
    sellableCards,
    openShopOffers: Number(offerCount?.value ?? 0),
    actionableOrders: Number(orderCount?.value ?? 0),
    newShopInquiries: Number(inquiryCount?.value ?? 0),
    unresolvedEbayJobs: Number(outboxCount?.value ?? 0),
    latestEbaySyncStatus: latestSync?.status ?? null,
    latestEbaySyncAt,
  }, ["SHOP_DB", "EBAY_CACHE"], latestEbaySyncAt);
}
