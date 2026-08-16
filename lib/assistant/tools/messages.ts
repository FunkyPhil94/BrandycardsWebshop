import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayInboxMessages, inquiries, products } from "../../../db/schema";
import { readEbayReadSyncStates } from "../../ebay-read-sync";
import { ebayReadAvailability } from "../ebay-availability";
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

/** Kopfdaten aus dem eBay-Postfach, ungelesene zuerst.
 *
 * Es gibt hier **keinen Nachrichtentext**, und das ist keine Auslassung: Der
 * Lesesync fordert bei eBay `DetailLevel ReturnHeaders` an, der Text kommt also
 * nie im Server an (siehe `lib/ebay-read-api.ts`). Für „gibt es etwas Neues?"
 * genügen Absender, Betreff und Zeitpunkt; lesen lässt sich die Nachricht dort,
 * wo auch geantwortet werden kann.
 */
export async function getEbayMessages(input: AssistantToolInput): Promise<AssistantToolResult<"ebay_messages">> {
  const db = getDb();
  const states = await readEbayReadSyncStates(db);
  const availability = ebayReadAvailability(states.get("MESSAGES"), "eBay-Postfach");
  if (!availability.available) {
    return unavailableAssistantResult("ebay_messages", availability.code, availability.message, ["EBAY_READ_API"]);
  }

  const [rows, [unread]] = await Promise.all([
    db.select({
      ebayMessageId: ebayInboxMessages.ebayMessageId,
      sender: ebayInboxMessages.sender,
      subject: ebayInboxMessages.subject,
      ebayItemId: ebayInboxMessages.ebayItemId,
      receivedAt: ebayInboxMessages.receivedAt,
      isRead: ebayInboxMessages.isRead,
    }).from(ebayInboxMessages)
      // Ungelesene zuerst, dann die jüngsten: Wer fragt, meint das Neue, nicht
      // das schon Erledigte.
      .orderBy(ebayInboxMessages.isRead, desc(sql`datetime(${ebayInboxMessages.receivedAt})`), desc(ebayInboxMessages.ebayMessageId))
      .limit(input.limit),
    db.select({ value: count() }).from(ebayInboxMessages).where(eq(ebayInboxMessages.isRead, false)),
  ]);

  return availableAssistantResult("ebay_messages", {
    unreadCount: Number(unread?.value ?? 0),
    messages: rows.map(({ isRead, ...row }) => ({
      ...row,
      receivedAt: assistantTimestamp(row.receivedAt),
      read: isRead,
    })),
  }, ["EBAY_READ_API"], availability.freshness);
}
