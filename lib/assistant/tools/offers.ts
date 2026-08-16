import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayListings, priceOffers, products } from "../../../db/schema";
import { availableAssistantResult, type AssistantToolInput, type AssistantToolResult } from "../contracts";
import { assistantTimestamp } from "../time";

const OPEN_SHOP_OFFER_STATUSES = ["NEW", "IN_REVIEW"] as const;

export async function listOpenShopOffers(input: AssistantToolInput): Promise<AssistantToolResult<"open_shop_offers">> {
  const rows = await getDb().select({
    id: priceOffers.id,
    productId: priceOffers.productId,
    title: products.title,
    proposedAmountCents: priceOffers.proposedAmountCents,
    listPriceAmountCents: ebayListings.priceAmountCents,
    currency: priceOffers.currency,
    status: priceOffers.status,
    createdAt: priceOffers.createdAt,
    expiresAt: priceOffers.expiresAt,
  }).from(priceOffers)
    .innerJoin(products, eq(products.id, priceOffers.productId))
    .leftJoin(ebayListings, eq(ebayListings.productId, priceOffers.productId))
    .where(inArray(priceOffers.status, [...OPEN_SHOP_OFFER_STATUSES]))
    .orderBy(desc(sql`datetime(${priceOffers.createdAt})`), desc(priceOffers.id))
    .limit(input.limit);

  return availableAssistantResult("open_shop_offers", {
    offers: rows.map((row) => ({
      ...row,
      createdAt: assistantTimestamp(row.createdAt),
      expiresAt: assistantTimestamp(row.expiresAt),
    })),
  }, ["SHOP_DB"], assistantTimestamp(rows[0]?.createdAt ?? null));
}
