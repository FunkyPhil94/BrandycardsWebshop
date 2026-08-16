import { createAssistantToolRegistry, type AssistantToolHandlers } from "./tool-registry";
import { getEbayBuyerOffers, getEbayMostViewed, getEbaySyncHealth } from "./tools/ebay";
import { getEbayMessages, listNewShopInquiries } from "./tools/messages";
import { listOpenShopOffers } from "./tools/offers";
import { getLatestSale } from "./tools/sales";
import { getInventoryReview, getLatestListing, listNewOrders } from "./tools/shop";
import { getAssistantStatistics } from "./tools/statistics";

const handlers: AssistantToolHandlers = {
  latest_sale: () => getLatestSale(),
  latest_listing: () => getLatestListing(),
  new_orders: (input) => listNewOrders(input),
  open_shop_offers: (input) => listOpenShopOffers(input),
  inventory_review: (input) => getInventoryReview(input),
  ebay_most_viewed: (input) => getEbayMostViewed(input),
  ebay_messages: (input) => getEbayMessages(input),
  ebay_buyer_offers: (input) => getEbayBuyerOffers(input),
  new_shop_inquiries: (input) => listNewShopInquiries(input),
  ebay_sync_health: (input) => getEbaySyncHealth(input),
  assistant_statistics: () => getAssistantStatistics(),
};

export const assistantToolRegistry = createAssistantToolRegistry(handlers);
