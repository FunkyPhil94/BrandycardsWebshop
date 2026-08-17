import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { avatarEvents, ebayListings, ebaySales, orderItems, orders, products } from "../../../db/schema";
import { readEbayReadSyncStates } from "../../ebay-read-sync";
import { ebayReadAvailability } from "../ebay-availability";
import {
  availableAssistantResult,
  boundedOverviewDays,
  SALES_OVERVIEW_DEFAULT_DAYS,
  type AssistantSaleItem,
  type AssistantSalesChannel,
  type AssistantToolInput,
  type AssistantToolResult,
} from "../contracts";
import { assistantTimestamp, assistantTimestampValue } from "../time";
import { verdichteAufTage } from "../statistics-series.ts";

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

/** Verkäufe und Umsatz der letzten `days` Tage — beide Kanäle nebeneinander.
 *
 * **Getrennt gezählt, gemeinsam ausgewiesen.** Shop und eBay sind zwei
 * Verkaufswege mit zwei Datenlagen: Die Shop-Bestellungen liegen vollständig
 * in der eigenen Datenbank, die eBay-Verkäufe nur so weit, wie der Lesesync
 * sie geholt hat. Eine Gesamtsumme entsteht deshalb **nur**, wenn beide
 * Hälften belastbar sind — sonst stünde eine Zahl da, die einen ganzen Kanal
 * verschweigt, und niemand sähe es ihr an.
 *
 * Der Umsatz ist **brutto**: das, was Käufer gezahlt haben, einschließlich des
 * von ihnen getragenen Versands, vor eBay-Gebühren und vor Steuern. Was eBay
 * einbehält, steht in der Fulfillment-Antwort nicht vollständig; eine Zahl
 * „nach Gebühren" wäre geraten. `revenueBasis` trägt diesen Satz mit, damit die
 * Zahl nicht ohne ihre Bezugsgröße weitergereicht wird.
 */

export async function getSalesOverview(
  input: Pick<AssistantToolInput<"sales_overview">, "limit" | "days" | "bis">,
  now: Date = new Date(),
): Promise<AssistantToolResult<"sales_overview">> {
  const db = getDb();
  const gewuenscht = input.days ?? SALES_OVERVIEW_DEFAULT_DAYS;
  const days = boundedOverviewDays(gewuenscht);
  // **Das Ende des Fensters.** `bis` nennt einen Tag *einschließlich*, das
  // Fenster endet also mit dessen letztem Moment. Ein Ende in der Zukunft wird
  // auf jetzt gezogen: „bis 31.12." darf keine leeren Tage anhängen, die dann
  // im Diagramm als verkaufsfreie Tage dastünden.
  const ende = input.bis
    ? new Date(Math.min(new Date(`${input.bis}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000, now.getTime()))
    : now;
  const since = new Date(ende.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const until = ende.toISOString();
  const limit = Math.min(20, Math.max(1, input.limit));

  const [shopOrders, ebayRows, syncStates] = await Promise.all([
    db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      currency: orders.currency,
      totalAmountCents: orders.totalAmountCents,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
    }).from(orders)
      .where(and(
        inArray(orders.status, [...SOLD_ORDER_STATUSES]),
        isNotNull(orders.paidAt),
        sql`datetime(COALESCE(${orders.paidAt}, ${orders.createdAt})) >= datetime(${since})`,
        // **Die Obergrenze ist neu und nicht überflüssig.** Solange das Fenster
        // immer jetzt endete, konnte nichts dahinterliegen. Bei einer genannten
        // Spanne wie „10.8 bis 12.8" zählte ohne sie alles bis heute mit.
        sql`datetime(COALESCE(${orders.paidAt}, ${orders.createdAt})) < datetime(${until})`,
      )),
    db.select({
      ebayOrderId: ebaySales.ebayOrderId,
      lineItemId: ebaySales.lineItemId,
      title: ebaySales.title,
      quantity: ebaySales.quantity,
      amountCents: ebaySales.amountCents,
      orderTotalCents: ebaySales.orderTotalCents,
      currency: ebaySales.currency,
      soldAt: ebaySales.soldAt,
    }).from(ebaySales).where(and(
      sql`datetime(${ebaySales.soldAt}) >= datetime(${since})`,
      sql`datetime(${ebaySales.soldAt}) < datetime(${until})`,
    )),
    readEbayReadSyncStates(db),
  ]);

  // --- Shop ---------------------------------------------------------------
  const shopItems = shopOrders.length
    ? await db.select({
        orderId: orderItems.orderId,
        title: orderItems.titleSnapshot,
        quantity: orderItems.quantity,
        amountCents: orderItems.totalAmountCents,
      }).from(orderItems).where(inArray(orderItems.orderId, shopOrders.map((order) => order.id)))
    : [];
  const shopItemCount = shopItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const shopRevenueCents = shopOrders.reduce((sum, order) => sum + (order.totalAmountCents ?? 0), 0);
  const shopCurrency = shopOrders[0]?.currency ?? "EUR";

  // --- eBay ---------------------------------------------------------------
  const availability = ebayReadAvailability(syncStates.get("SALES"), "eBay-Verkäufe");
  // Der Gesamtbetrag steht auf jedem Posten derselben Bestellung. Summiert wird
  // deshalb über *verschiedene* Bestellungen -- eine Bestellung mit drei Karten
  // zählte sonst dreifach.
  const ebayOrderTotals = new Map<string, number | null>();
  for (const row of ebayRows) ebayOrderTotals.set(row.ebayOrderId, row.orderTotalCents);
  const ebayRevenueCents = [...ebayOrderTotals.values()].reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const ebayItemCount = ebayRows.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  const ebayCurrency = ebayRows[0]?.currency ?? shopCurrency;

  const ebayChannel: AssistantSalesChannel = availability.available
    ? {
        available: true,
        orderCount: ebayOrderTotals.size,
        itemCount: ebayItemCount,
        revenueCents: ebayRevenueCents,
        currency: ebayCurrency,
        unavailableCode: null,
        unavailableMessage: null,
      }
    : {
        available: false,
        orderCount: 0,
        itemCount: 0,
        revenueCents: null,
        currency: shopCurrency,
        unavailableCode: availability.code,
        unavailableMessage: availability.message,
      };

  // --- Zusammenführen -----------------------------------------------------
  const einzelverkaeufe = [
    ...shopOrders.map((order) => ({
      channel: "SHOP" as const,
      reference: order.orderNumber,
      title: shopItems.find((item) => item.orderId === order.id)?.title ?? null,
      quantity: shopItems.filter((item) => item.orderId === order.id).reduce((sum, item) => sum + (item.quantity ?? 0), 0) || 1,
      amountCents: order.totalAmountCents ?? null,
      currency: order.currency,
      soldAt: assistantTimestamp(order.paidAt ?? order.createdAt),
    })),
    ...(ebayChannel.available ? ebayRows.map((row) => ({
      channel: "EBAY" as const,
      reference: row.ebayOrderId,
      title: row.title,
      quantity: row.quantity,
      amountCents: row.amountCents,
      currency: row.currency,
      soldAt: assistantTimestamp(row.soldAt),
    })) : []),
  ].sort((a, b) => assistantTimestampValue(b.soldAt) - assistantTimestampValue(a.soldAt));

  // Währungen nicht stillschweigend addieren: Zwei Beträge in verschiedenen
  // Währungen zu summieren ergäbe eine Zahl ohne Bedeutung.
  const waehrungen = new Set(einzelverkaeufe.map((verkauf) => verkauf.currency));
  const einheitlich = waehrungen.size <= 1;
  const gesamtMoeglich = ebayChannel.available && einheitlich;

  return availableAssistantResult("sales_overview", {
    days,
    since,
    until,
    spanneGenannt: input.bis !== undefined,
    gekuerzt: gewuenscht > days,
    revenueBasis: einheitlich
      ? "Bruttoumsatz: was Käufer gezahlt haben, inklusive des von ihnen getragenen Versands, vor eBay-Gebühren."
      : "Bruttoumsatz je Kanal; eine Gesamtsumme entfällt, weil mehrere Währungen vorkommen.",
    currency: shopCurrency,
    channels: {
      shop: {
        available: true,
        orderCount: shopOrders.length,
        itemCount: shopItemCount,
        revenueCents: shopRevenueCents,
        currency: shopCurrency,
        unavailableCode: null,
        unavailableMessage: null,
      },
      ebay: ebayChannel,
    },
    totalRevenueCents: gesamtMoeglich ? shopRevenueCents + ebayRevenueCents : null,
    totalItemCount: ebayChannel.available ? shopItemCount + ebayItemCount : null,
    sales: einzelverkaeufe.slice(0, limit),
    // Der letzte Moment *vor* dem Ende: `until` ist der Beginn des Folgetags,
    // und daraus entstünde eine leere Säule für einen Tag, nach dem niemand
    // gefragt hat.
    ...verdichteAufTage(einzelverkaeufe, since, new Date(ende.getTime() - 1)),
  }, ebayChannel.available ? ["SHOP_DB", "EBAY_READ_API"] : ["SHOP_DB"], availability.available ? availability.freshness : null);
}
