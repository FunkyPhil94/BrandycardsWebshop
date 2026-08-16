import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { inquiries, products } from "../../../db/schema";
import { availableAssistantResult, unavailableAssistantResult, type AssistantToolInput, type AssistantToolResult } from "../contracts";
import { assistantTimestamp } from "../time";

function inquiryTitle(value: unknown): string {
  if (typeof value !== "string") return "Anfrage";
  try {
    const parsed = JSON.parse(value) as { title?: unknown };
    return typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 160) : "Anfrage";
  } catch {
    return "Anfrage";
  }
}

export async function listNewShopInquiries(input: AssistantToolInput): Promise<AssistantToolResult<"new_shop_inquiries">> {
  const rows = await getDb().select({
    id: inquiries.id,
    message: inquiries.message,
    productTitle: products.title,
    status: inquiries.status,
    createdAt: inquiries.createdAt,
  }).from(inquiries)
    .leftJoin(products, eq(products.id, inquiries.productId))
    .where(eq(inquiries.status, "NEW"))
    .orderBy(desc(sql`datetime(${inquiries.createdAt})`), desc(inquiries.id))
    .limit(input.limit);

  return availableAssistantResult("new_shop_inquiries", {
    inquiries: rows.map(({ message, ...row }) => ({
      ...row,
      title: inquiryTitle(message),
      createdAt: assistantTimestamp(row.createdAt),
    })),
  }, ["SHOP_DB"], assistantTimestamp(rows[0]?.createdAt ?? null));
}

export async function getEbayMessages(): Promise<AssistantToolResult<"ebay_messages">> {
  return unavailableAssistantResult(
    "ebay_messages",
    "SOURCE_NOT_CONNECTED",
    "Das eBay-Postfach ist noch nicht über einen serverseitigen, lesenden Nachrichten-Client angebunden.",
  );
}
