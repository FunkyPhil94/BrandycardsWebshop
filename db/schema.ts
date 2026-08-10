import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// The application creates IDs and keeps them opaque. This SQLite default also
// makes direct inserts safe during migrations and local development.
const id = (name = "id") =>
  // SQLite requires non-constant DEFAULT expressions to be parenthesized.
  // This form is accepted by Cloudflare D1 as well as local SQLite.
  text(name).primaryKey().notNull().default(sql`(lower(hex(randomblob(16))))`);
const timestamp = (name: string) =>
  text(name).notNull().default(sql`CURRENT_TIMESTAMP`);
const optionalTimestamp = (name: string) => text(name);
const json = (name: string) => text(name, { mode: "json" });

export const userRoleValues = ["CUSTOMER", "ADMIN"] as const;
export const productKindValues = ["EBAY_SYNCED", "PRELISTED"] as const;
/** Woher eine Karte stammt — und **der** Schalter für „von Hand eingestellt".
 *
 * `kind` ließ sich nicht erweitern: Die CHECK-Bedingung darauf ist auf D1
 * unveränderlich. Die Begründung samt der beiden verworfenen Versuche steht in
 * `drizzle/0006_manual_cards_and_oauth_claims.sql` — kurz: `DROP TABLE` löst
 * die Kaskaden der Kindtabellen aus, `PRAGMA foreign_keys = OFF` greift auf D1
 * nicht, und ein `RENAME` scheitert an der qualifiziert geschriebenen
 * CHECK-Bedingung.
 *
 * Manuelle Karten tragen deshalb `kind = 'PRELISTED'` **und**
 * `origin = 'MANUAL'`. Wer `kind` liest, um „ist das käuflich?" zu beantworten,
 * liest die falsche Spalte: `kind` sagt nur noch, ob der Waisen-Sweep die Zeile
 * abräumt (`EBAY_SYNCED` ja, alles andere nein). */
export const productOriginValues = ["EBAY", "MANUAL"] as const;
export const productStatusValues = ["ACTIVE", "INACTIVE", "SOLD"] as const;
export const listingStatusValues = ["ACTIVE", "ENDED", "HIDDEN"] as const;
export const inventoryStatusValues = ["AVAILABLE", "RESERVED", "SOLD", "UNAVAILABLE"] as const;
export const orderStatusValues = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED", "REFUNDED"] as const;
export const paymentStatusValues = ["CREATED", "APPROVED", "CAPTURED", "FAILED", "VOIDED", "REFUNDED"] as const;
export const inquiryStatusValues = ["NEW", "IN_REVIEW", "RESPONDED", "CLOSED", "SPAM"] as const;
export const offerStatusValues = ["NEW", "IN_REVIEW", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"] as const;
export const submissionStatusValues = ["NEW", "IN_REVIEW", "NEEDS_INFO", "ACCEPTED", "REJECTED", "CLOSED"] as const;
export const syncRunStatusValues = ["RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"] as const;
export const syncEventStatusValues = ["IMPORTED", "UPDATED", "DEACTIVATED", "SKIPPED", "FAILED"] as const;
export const ebayOutboxStatusValues = ["PENDING", "PROCESSING", "RETRY_WAIT", "SUCCEEDED", "FAILED", "CANCELLED"] as const;
export const localeValues = ["de", "en"] as const;

export const users = sqliteTable("users", {
  id: id(),
  role: text("role", { enum: userRoleValues }).notNull().default("CUSTOMER"),
  email: text("email").notNull(),
  username: text("username"),
  emailVerifiedAt: optionalTimestamp("email_verified_at"),
  displayName: text("display_name"),
  preferredLocale: text("preferred_locale", { enum: localeValues }).notNull().default("de"),
  authProvider: text("auth_provider"),
  authSubject: text("auth_subject"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  uniqueIndex("users_username_unique").on(table.username),
  uniqueIndex("users_provider_subject_unique").on(table.authProvider, table.authSubject),
  index("users_role_idx").on(table.role),
  check("users_role_check", sql`${table.role} IN ('CUSTOMER', 'ADMIN')`),
  check("users_preferred_locale_check", sql`${table.preferredLocale} IN ('de', 'en')`),
]);

export const products = sqliteTable("products", {
  id: id(),
  kind: text("kind", { enum: productKindValues }).notNull(),
  origin: text("origin", { enum: productOriginValues }).notNull().default("EBAY"),
  status: text("status", { enum: productStatusValues }).notNull().default("ACTIVE"),
  title: text("title").notNull(),
  // Only eBay-synchronised products need extended offer data. PRELISTED
  // products intentionally remain title-first with optional assets.
  description: text("description"),
  // Preis am Produkt. Bei eBay-Karten steht er im Listing und bleibt hier leer;
  // eine manuelle Vorverkaufskarte hat bewusst ebenfalls keinen Festpreis.
  priceAmountCents: integer("price_amount_cents"),
  priceCurrency: text("price_currency").notNull().default("EUR"),
  // Welche Felder von Hand gesetzt wurden, als JSON-Liste von Feldnamen. Der
  // Sync lässt genau diese Felder in Ruhe und überschreibt alle anderen.
  manualOverrides: json("manual_overrides").$type<string[]>(),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  index("products_kind_status_idx").on(table.kind, table.status),
  index("products_origin_status_idx").on(table.origin, table.status),
  index("products_origin_title_idx").on(table.origin, table.title),
  index("products_title_idx").on(table.title),
  check("products_kind_check", sql`${table.kind} IN ('EBAY_SYNCED', 'PRELISTED')`),
  check("products_status_check", sql`${table.status} IN ('ACTIVE', 'INACTIVE', 'SOLD')`),
]);

export const ebayListings = sqliteTable("ebay_listings", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  ebayItemId: text("ebay_item_id").notNull(),
  ebayOfferId: text("ebay_offer_id"),
  ebayListingId: text("ebay_listing_id"),
  sku: text("sku"),
  title: text("title").notNull(),
  descriptionHtml: text("description_html"),
  priceAmountCents: integer("price_amount_cents"),
  priceCurrency: text("price_currency").notNull().default("EUR"),
  quantity: integer("quantity").notNull().default(1),
  quantitySold: integer("quantity_sold").notNull().default(0),
  conditionId: text("condition_id"),
  conditionDescription: text("condition_description"),
  listingType: text("listing_type").notNull().default("FIXED_PRICE"),
  listingUrl: text("listing_url"),
  categoryId: text("category_id"),
  startAt: optionalTimestamp("start_at"),
  endAt: optionalTimestamp("end_at"),
  shippingData: json("shipping_data"),
  rawData: json("raw_data"),
  status: text("status", { enum: listingStatusValues }).notNull().default("ACTIVE"),
  lastSyncedAt: optionalTimestamp("last_synced_at"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  uniqueIndex("ebay_item_id_unique").on(table.ebayItemId),
  uniqueIndex("ebay_product_unique").on(table.productId),
  index("ebay_listing_status_idx").on(table.status),
  index("ebay_sku_idx").on(table.sku),
  check("ebay_listing_quantity_check", sql`${table.quantity} >= 0 AND ${table.quantitySold} >= 0`),
]);

export const productAssets = sqliteTable("product_assets", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  sourceUrl: text("source_url"),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  createdAt: timestamp("created_at"),
}, (table) => [
  uniqueIndex("product_asset_storage_key_unique").on(table.storageKey),
  index("product_assets_product_idx").on(table.productId, table.sortOrder),
]);

export const inventory = sqliteTable("inventory", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  status: text("status", { enum: inventoryStatusValues }).notNull().default("AVAILABLE"),
  availableQuantity: integer("available_quantity").notNull().default(1),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  soldQuantity: integer("sold_quantity").notNull().default(0),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  uniqueIndex("inventory_product_unique").on(table.productId),
  check("inventory_quantities_check", sql`${table.availableQuantity} >= 0 AND ${table.reservedQuantity} >= 0 AND ${table.soldQuantity} >= 0`),
]);

export const reservations = sqliteTable("reservations", {
  id: id(),
  orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  inventoryId: text("inventory_id").notNull().references(() => inventory.id, { onDelete: "restrict" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  guestEmail: text("guest_email"),
  quantity: integer("quantity").notNull().default(1),
  status: text("status").notNull().default("ACTIVE"),
  expiresAt: text("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  releasedAt: optionalTimestamp("released_at"),
}, (table) => [
  index("reservations_product_status_idx").on(table.productId, table.status),
  index("reservations_expiry_idx").on(table.expiresAt),
  check("reservations_status_check", sql`${table.status} IN ('ACTIVE', 'RELEASED', 'CONVERTED', 'EXPIRED')`),
]);

export const orders = sqliteTable("orders", {
  id: id(),
  orderNumber: text("order_number").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  guestEmail: text("guest_email"),
  status: text("status", { enum: orderStatusValues }).notNull().default("PENDING"),
  currency: text("currency").notNull().default("EUR"),
  subtotalAmountCents: integer("subtotal_amount_cents").notNull(),
  shippingAmountCents: integer("shipping_amount_cents").notNull().default(0),
  totalAmountCents: integer("total_amount_cents").notNull(),
  shippingAddress: json("shipping_address"),
  billingAddress: json("billing_address"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  paidAt: optionalTimestamp("paid_at"),
  shippedAt: optionalTimestamp("shipped_at"),
  shippingCarrier: text("shipping_carrier"),
  trackingNumber: text("tracking_number"),
  completedAt: optionalTimestamp("completed_at"),
  cancelledAt: optionalTimestamp("cancelled_at"),
  refundedAt: optionalTimestamp("refunded_at"),
}, (table) => [
  uniqueIndex("orders_number_unique").on(table.orderNumber),
  index("orders_user_status_idx").on(table.userId, table.status),
  check("orders_amounts_check", sql`${table.subtotalAmountCents} >= 0 AND ${table.shippingAmountCents} >= 0 AND ${table.totalAmountCents} >= 0`),
]);

export const orderItems = sqliteTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  titleSnapshot: text("title_snapshot").notNull(),
  skuSnapshot: text("sku_snapshot"),
  quantity: integer("quantity").notNull().default(1),
  unitAmountCents: integer("unit_amount_cents").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  productSnapshot: json("product_snapshot"),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const payments = sqliteTable("payments", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("PAYPAL"),
  providerOrderId: text("provider_order_id"),
  providerCaptureId: text("provider_capture_id"),
  status: text("status", { enum: paymentStatusValues }).notNull().default("CREATED"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  rawData: json("raw_data"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  uniqueIndex("payments_provider_order_unique").on(table.provider, table.providerOrderId),
  index("payments_order_status_idx").on(table.orderId, table.status),
]);

export const inquiries = sqliteTable("inquiries", {
  id: id(),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  guestEmail: text("guest_email").notNull(),
  name: text("name"),
  message: text("message").notNull(),
  status: text("status", { enum: inquiryStatusValues }).notNull().default("NEW"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  respondedAt: optionalTimestamp("responded_at"),
}, (table) => [index("inquiries_status_created_idx").on(table.status, table.createdAt)]);

export const priceOffers = sqliteTable("price_offers", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  guestEmail: text("guest_email").notNull(),
  proposedAmountCents: integer("proposed_amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  message: text("message"),
  status: text("status", { enum: offerStatusValues }).notNull().default("NEW"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  expiresAt: optionalTimestamp("expires_at"),
}, (table) => [index("price_offers_product_status_idx").on(table.productId, table.status)]);

export const cardSubmissions = sqliteTable("card_submissions", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  guestEmail: text("guest_email").notNull(),
  name: text("name"),
  message: text("message"),
  requestedAmountCents: integer("requested_amount_cents"),
  currency: text("currency").notNull().default("EUR"),
  status: text("status", { enum: submissionStatusValues }).notNull().default("NEW"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => [index("card_submissions_status_created_idx").on(table.status, table.createdAt)]);

export const cardSubmissionAssets = sqliteTable("card_submission_assets", {
  id: id(),
  submissionId: text("submission_id").notNull().references(() => cardSubmissions.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: timestamp("created_at"),
}, (table) => [
  uniqueIndex("card_submission_asset_key_unique").on(table.storageKey),
  index("card_submission_assets_submission_idx").on(table.submissionId),
]);

export const syncRuns = sqliteTable("sync_runs", {
  id: id(),
  source: text("source").notNull().default("EBAY"),
  status: text("status", { enum: syncRunStatusValues }).notNull().default("RUNNING"),
  startedAt: timestamp("started_at"),
  finishedAt: optionalTimestamp("finished_at"),
  importedCount: integer("imported_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  deactivatedCount: integer("deactivated_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  errorMessage: text("error_message"),
}, (table) => [index("sync_runs_started_idx").on(table.startedAt)]);

export const syncEvents = sqliteTable("sync_events", {
  id: id(),
  syncRunId: text("sync_run_id").notNull().references(() => syncRuns.id, { onDelete: "cascade" }),
  ebayItemId: text("ebay_item_id"),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  status: text("status", { enum: syncEventStatusValues }).notNull(),
  message: text("message"),
  payload: json("payload"),
  createdAt: timestamp("created_at"),
}, (table) => [index("sync_events_run_idx").on(table.syncRunId), index("sync_events_item_idx").on(table.ebayItemId)]);

export const webhookEvents = sqliteTable("webhook_events", {
  id: id(),
  provider: text("provider").notNull(),
  externalEventId: text("external_event_id").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("RECEIVED"),
  payload: json("payload"),
  receivedAt: timestamp("received_at"),
  processedAt: optionalTimestamp("processed_at"),
  errorMessage: text("error_message"),
}, (table) => [
  uniqueIndex("webhook_provider_event_unique").on(table.provider, table.externalEventId),
  index("webhook_status_idx").on(table.status),
  check("webhook_status_check", sql`${table.status} IN ('RECEIVED', 'PROCESSED', 'FAILED')`),
]);

// The outbox contains absolute eBay target states. It decouples the local
// checkout transaction from eBay availability and makes retries safe.
export const ebayOutbox = sqliteTable("ebay_outbox", {
  id: id(),
  aggregateType: text("aggregate_type").notNull().default("LISTING"),
  aggregateId: text("aggregate_id").notNull(),
  ebayItemId: text("ebay_item_id"),
  ebayOfferId: text("ebay_offer_id"),
  operation: text("operation").notNull(),
  payload: json("payload").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  status: text("status", { enum: ebayOutboxStatusValues }).notNull().default("PENDING"),
  attemptCount: integer("attempt_count").notNull().default(0),
  availableAt: timestamp("available_at"),
  lockedAt: optionalTimestamp("locked_at"),
  lastAttemptAt: optionalTimestamp("last_attempt_at"),
  succeededAt: optionalTimestamp("succeeded_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  uniqueIndex("ebay_outbox_dedupe_unique").on(table.dedupeKey),
  index("ebay_outbox_available_idx").on(table.status, table.availableAt),
  index("ebay_outbox_lock_idx").on(table.status, table.lockedAt),
  index("ebay_outbox_listing_idx").on(table.ebayItemId, table.operation, table.status),
  check("ebay_outbox_status_check", sql`${table.status} IN ('PENDING', 'PROCESSING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'CANCELLED')`),
]);

export const auditEvents = sqliteTable("audit_events", {
  id: id(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: json("metadata"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at"),
}, (table) => [index("audit_entity_idx").on(table.entityType, table.entityId), index("audit_actor_idx").on(table.actorUserId, table.createdAt)]);

/** SEC-12: kurzlebige Ablage für den eBay-Refresh-Token zwischen der
 *  Browser-Umleitung von eBay und dem angemeldeten Adminbereich. Die Zeile wird
 *  beim Abholen gelöscht; abgelaufene räumt der geplante Lauf ab. */
export const ebayOauthClaims = sqliteTable("ebay_oauth_claims", {
  id: id(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: timestamp("created_at"),
}, (table) => [index("ebay_oauth_claims_expiry_idx").on(table.expiresAt)]);

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
