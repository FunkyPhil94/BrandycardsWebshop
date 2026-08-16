import { createAssistantToolRegistry, type AssistantToolHandlers } from "./tool-registry";
import { getEbayMostViewed, getEbaySyncHealth } from "./tools/ebay";
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
  ebay_most_viewed: () => getEbayMostViewed(),
  ebay_messages: () => getEbayMessages(),
  new_shop_inquiries: (input) => listNewShopInquiries(input),
  ebay_sync_health: (input) => getEbaySyncHealth(input),
  assistant_statistics: () => getAssistantStatistics(),
};

export const assistantToolRegistry = createAssistantToolRegistry(handlers);
