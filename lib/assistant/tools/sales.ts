import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { avatarEvents, ebayListings, orderItems, orders, products } from "../../../db/schema";
import { availableAssistantResult, type AssistantSaleItem, type AssistantToolResult } from "../contracts";
import { assistantTimestamp, assistantTimestampValue } from "../time";

const SOLD_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "COMPLETED", "REFUNDED"] as const;

function ebayEventQuantity(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const quantity = (value as Record<string, unknown>).quantity;
  return typeof quantity === "number" && Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

export async function getLatestSale(): Promise<AssistantToolResult<"latest_sale">> {
  const db = getDb();
  const [[shopOrder], [ebayEvent]] = await Promise.all([
    db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      currency: orders.currency,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
    }).from(orders)
      .where(and(inArray(orders.status, [...SOLD_ORDER_STATUSES]), isNotNull(orders.paidAt)))
      .orderBy(desc(sql`datetime(COALESCE(${orders.paidAt}, ${orders.createdAt}))`), desc(orders.id))
      .limit(1),
    db.select({
      aggregateId: avatarEvents.aggregateId,
      eventPayload: avatarEvents.payload,
      soldAt: avatarEvents.createdAt,
    }).from(avatarEvents)
      .where(and(eq(avatarEvents.eventType, "CARD_SOLD"), eq(avatarEvents.aggregateType, "EBAY_LISTING")))
      .orderBy(desc(sql`datetime(${avatarEvents.createdAt})`), desc(avatarEvents.id))
      .limit(1),
  ]);

  const shopSoldAt = shopOrder?.paidAt ?? shopOrder?.createdAt ?? null;
  if (ebayEvent && assistantTimestampValue(ebayEvent.soldAt) > assistantTimestampValue(shopSoldAt)) {
    const [listing] = await db.select({
      productId: products.id,
      title: products.title,
      listingTitle: ebayListings.title,
      ebayItemId: ebayListings.ebayItemId,
      priceCurrency: ebayListings.priceCurrency,
    }).from(ebayListings)
      .leftJoin(products, eq(products.id, ebayListings.productId))
      .where(eq(ebayListings.id, ebayEvent.aggregateId))
      .limit(1);
    const quantity = ebayEventQuantity(ebayEvent.eventPayload);
    return availableAssistantResult("latest_sale", {
      sale: {
        source: "EBAY",
        reference: listing?.ebayItemId ?? ebayEvent.aggregateId,
        status: "SOLD",
        soldAt: assistantTimestamp(ebayEvent.soldAt),
        detailsComplete: Boolean(listing?.productId && quantity !== null),
        items: [{
          productId: listing?.productId ?? null,
          title: listing?.title ?? listing?.listingTitle ?? "Nicht mehr zugeordnetes eBay-Angebot",
          quantity,
          // Der Listingpreis ist nicht zwingend der Transaktionspreis (z. B. Best Offer).
          amountCents: null,
          currency: listing?.priceCurrency ?? "EUR",
        }],
      },
    }, listing ? ["EBAY_WEBHOOK", "EBAY_CACHE"] : ["EBAY_WEBHOOK"], assistantTimestamp(ebayEvent.soldAt));
  }

  if (!shopOrder) {
    return availableAssistantResult("latest_sale", { sale: null }, ["SHOP_DB", "EBAY_WEBHOOK"]);
  }

  const itemRows = await db.select({
    productId: orderItems.productId,
    title: orderItems.titleSnapshot,
    quantity: orderItems.quantity,
    amountCents: orderItems.totalAmountCents,
  }).from(orderItems).where(eq(orderItems.orderId, shopOrder.id));
  const items: AssistantSaleItem[] = itemRows.map((item) => ({ ...item, currency: shopOrder.currency }));

  return availableAssistantResult("latest_sale", {
    sale: {
      source: "SHOP",
      reference: shopOrder.orderNumber,
      status: shopOrder.status,
      soldAt: assistantTimestamp(shopSoldAt),
      detailsComplete: true,
      items,
    },
  }, ["SHOP_DB"], assistantTimestamp(shopSoldAt));
}
