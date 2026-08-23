import { createAssistantToolRegistry, type AssistantToolHandlers } from "./tool-registry";
import { getActivityDigest } from "./tools/activity";
import { searchCards } from "./tools/catalog";
import { getEbayBuyerOffers, getEbayLeastViewed, getEbayMostViewed, getEbaySyncHealth } from "./tools/ebay";
import { getEbayMessages, listNewShopInquiries } from "./tools/messages";
import { listOpenShopOffers } from "./tools/offers";
import { getLatestSale, getSalesOverview } from "./tools/sales";
import { getInventoryReview, getLatestListing, listNewOrders } from "./tools/shop";
import { getAssistantStatistics } from "./tools/statistics";
import { getTrafficOverview } from "./tools/traffic";

const handlers: AssistantToolHandlers = {
  card_search: (input) => searchCards(input),
  activity_digest: (input) => getActivityDigest(input),
  ebay_least_viewed: (input) => getEbayLeastViewed(input),
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
  sales_overview: (input) => getSalesOverview(input),
  traffic_overview: (input) => getTrafficOverview(input),
};

export const assistantToolRegistry = createAssistantToolRegistry(handlers);
