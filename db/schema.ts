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
export const avatarEventTypeValues = [
  "OFFER_RECEIVED",
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
  "CARD_SOLD",
] as const;
export type AvatarEventType = (typeof avatarEventTypeValues)[number];
export const avatarDeviceScopeValues = ["EVENTS", "ASSISTANT_READ"] as const;
export type AvatarDeviceScope = (typeof avatarDeviceScopeValues)[number];

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

export const avatarEvents = sqliteTable("avatar_events", {
  id: id(),
  eventType: text("event_type", { enum: avatarEventTypeValues }).notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  payload: json("payload"),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: timestamp("created_at"),
}, (table) => [
  uniqueIndex("avatar_events_dedupe_unique").on(table.dedupeKey),
  index("avatar_events_created_idx").on(table.createdAt),
  check("avatar_event_type_check", sql`${table.eventType} IN ('OFFER_RECEIVED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'CARD_SOLD')`),
]);

export const avatarDevicePairings = sqliteTable("avatar_device_pairings", {
  id: id(),
  codeHash: text("code_hash").notNull(),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at"),
  claimedAt: optionalTimestamp("claimed_at"),
  createdAt: timestamp("created_at"),
}, (table) => [
  uniqueIndex("avatar_device_pairings_code_unique").on(table.codeHash),
  index("avatar_device_pairings_expiry_idx").on(table.expiresAt),
]);

export const avatarDeviceTokens = sqliteTable("avatar_device_tokens", {
  id: id(),
  tokenHash: text("token_hash").notNull(),
  label: text("label").notNull().default("BrandyCards Desktop Avatar"),
  scopes: json("scopes").$type<AvatarDeviceScope[]>().notNull().default(sql`'["EVENTS"]'`),
  pairingId: text("pairing_id"),
  createdByUserId: text("created_by_user_id"),
  expiresAt: optionalTimestamp("expires_at"),
  createdAt: timestamp("created_at"),
  revokedAt: optionalTimestamp("revoked_at"),
}, (table) => [
  uniqueIndex("avatar_device_tokens_hash_unique").on(table.tokenHash),
  index("avatar_device_tokens_revoked_idx").on(table.revokedAt),
  index("avatar_device_tokens_expiry_idx").on(table.expiresAt),
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

export const ebayReadDataTypeValues = ["TRAFFIC", "MESSAGES", "BEST_OFFERS", "SALES"] as const;
export type EbayReadDataType = (typeof ebayReadDataTypeValues)[number];
export const ebayReadSyncStatusValues = ["OK", "NOT_CONFIGURED", "SCOPE_NOT_GRANTED", "RATE_LIMITED", "UPSTREAM_ERROR"] as const;
export type EbayReadSyncStatus = (typeof ebayReadSyncStatusValues)[number];

/** Der Zustand je lesender eBay-Quelle — und der Grund, warum der Assistant
 *  „nichts da" von „nicht abrufbar" unterscheiden kann.
 *
 * Ohne diese Tabelle sähen beide Fälle gleich aus: null Zeilen. Ein leeres
 * Postfach und ein fehlender OAuth-Scope wären nicht zu trennen, und die
 * ehrlichste mögliche Antwort wäre geraten. Eine Zeile je Datentyp, vom
 * Lesesync gepflegt.
 */
export const ebayReadSyncs = sqliteTable("ebay_read_syncs", {
  id: id(),
  dataType: text("data_type", { enum: ebayReadDataTypeValues }).notNull(),
  status: text("status", { enum: ebayReadSyncStatusValues }).notNull(),
  lastAttemptAt: timestamp("last_attempt_at"),
  lastSuccessAt: optionalTimestamp("last_success_at"),
  recordCount: integer("record_count").notNull().default(0),
  /** Gekürzte Fehlerbeschreibung. Nie ein Token, nie ein Nachrichtentext. */
  detail: text("detail"),
}, (table) => [
  uniqueIndex("ebay_read_syncs_type_unique").on(table.dataType),
  check("ebay_read_syncs_type_check", sql`${table.dataType} IN ('TRAFFIC', 'MESSAGES', 'BEST_OFFERS', 'SALES')`),
  check("ebay_read_syncs_status_check", sql`${table.status} IN ('OK', 'NOT_CONFIGURED', 'SCOPE_NOT_GRANTED', 'RATE_LIMITED', 'UPSTREAM_ERROR')`),
]);

/** Aufrufzahlen je Angebot und Zeitfenster.
 *
 * Der Schlüssel enthält das Fenster, weil eBay keine Momentaufnahme liefert,
 * sondern eine Summe über einen Zeitraum. Zwei Läufe im selben Fenster
 * schreiben dieselbe Zeile fort statt eine zweite anzulegen.
 */
export const ebayListingTraffic = sqliteTable("ebay_listing_traffic", {
  id: id(),
  ebayItemId: text("ebay_item_id").notNull(),
  rangeStart: text("range_start").notNull(),
  rangeEnd: text("range_end").notNull(),
  viewsTotal: integer("views_total"),
  impressionsTotal: integer("impressions_total"),
  collectedAt: timestamp("collected_at"),
}, (table) => [
  uniqueIndex("ebay_listing_traffic_window_unique").on(table.ebayItemId, table.rangeStart, table.rangeEnd),
  index("ebay_listing_traffic_rank_idx").on(table.rangeEnd, table.viewsTotal),
]);

/** Kopfdaten des eBay-Postfachs. **Ohne Nachrichtentext** — der wird bei eBay
 *  gar nicht erst angefordert, siehe `lib/ebay-read-api.ts`. */
export const ebayInboxMessages = sqliteTable("ebay_inbox_messages", {
  id: id(),
  ebayMessageId: text("ebay_message_id").notNull(),
  sender: text("sender"),
  subject: text("subject").notNull(),
  ebayItemId: text("ebay_item_id"),
  receivedAt: optionalTimestamp("received_at"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  collectedAt: timestamp("collected_at"),
}, (table) => [
  uniqueIndex("ebay_inbox_messages_id_unique").on(table.ebayMessageId),
  index("ebay_inbox_messages_unread_idx").on(table.isRead, table.receivedAt),
]);

/** Offene Käufer-Preisvorschläge auf eigene eBay-Angebote.
 *
 * Bewusst **ohne Käuferkennung und ohne Nachrichtentext**: Für „gibt es neue
 * Vorschläge?" zählen Karte, Betrag und Frist. Wer geboten hat, steht bei eBay
 * und braucht hier keine zweite Ablage.
 */
export const ebayBuyerOffers = sqliteTable("ebay_buyer_offers", {
  id: id(),
  bestOfferId: text("best_offer_id").notNull(),
  ebayItemId: text("ebay_item_id").notNull(),
  amountCents: integer("amount_cents"),
  currency: text("currency").notNull().default("EUR"),
  quantity: integer("quantity"),
  status: text("status").notNull(),
  hasBuyerMessage: integer("has_buyer_message", { mode: "boolean" }).notNull().default(false),
  expiresAt: optionalTimestamp("expires_at"),
  collectedAt: timestamp("collected_at"),
}, (table) => [
  uniqueIndex("ebay_buyer_offers_id_unique").on(table.bestOfferId),
  index("ebay_buyer_offers_expiry_idx").on(table.expiresAt),
]);

/** Verkaufte Posten aus der eBay-Verkaufshistorie (Fulfillment API).
 *
 * **Diese Tabelle wird nie leergeräumt — anders als die drei aus Phase 8.**
 * Aufrufzahlen, Postfach und Preisvorschläge sind Momentaufnahmen: Was eBay
 * nicht mehr meldet, gilt dort als vorbei, und der Lauf löscht es. Ein Verkauf
 * ist das Gegenteil, nämlich eine Tatsache. Er fällt irgendwann aus dem
 * Abfragefenster heraus, ohne aufzuhören, stattgefunden zu haben. Würde hier
 * dieselbe Fensterschreibweise gelten, verlöre der Shop bei jedem Lauf die
 * Verkäufe, die älter als das Fenster sind — und die Übersicht „letzte 90 Tage"
 * schrumpfte still auf „letzte 90 Tage minus das, was eBay gerade zurückgibt".
 *
 * Deshalb: einfügen und fortschreiben, nie löschen. Der Schlüssel aus
 * Bestellung und Posten macht das wiederholbar.
 *
 * Bewusst **ohne Käuferdaten** — kein Name, keine Anschrift, keine Kennung.
 * Für „was habe ich verkauft und für wie viel?" braucht es niemanden.
 */
export const ebaySales = sqliteTable("ebay_sales", {
  id: id(),
  ebayOrderId: text("ebay_order_id").notNull(),
  lineItemId: text("line_item_id").notNull(),
  ebayItemId: text("ebay_item_id"),
  title: text("title"),
  quantity: integer("quantity").notNull().default(1),
  /** Der Posten selbst. */
  amountCents: integer("amount_cents"),
  /** Was der Käufer für die **ganze** Bestellung gezahlt hat, auf jedem Posten
   *  derselben Bestellung wiederholt. Der Umsatz summiert über *verschiedene*
   *  Bestellungen — sonst zählte eine Bestellung mit drei Karten dreifach. */
  orderTotalCents: integer("order_total_cents"),
  currency: text("currency").notNull().default("EUR"),
  soldAt: timestamp("sold_at"),
  collectedAt: timestamp("collected_at"),
}, (table) => [
  uniqueIndex("ebay_sales_line_unique").on(table.ebayOrderId, table.lineItemId),
  index("ebay_sales_sold_idx").on(table.soldAt),
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

/** Fragen an den Assistenten, die unbeantwortet blieben.
 *
 * **Der Zweck ist der Werkzeugausbau.** Zwölf Werkzeuge sind eingerichtet;
 * welche fehlen, war bis zum 2026-08-17 unbekannt, weil eine `UNSUPPORTED`-Frage
 * spurlos verschwand. Damit wäre jede weitere Erweiterung geraten.
 *
 * **Nur Unbeantwortetes**, und das ist eine Entscheidung: Bei beantworteten
 * Fragen ist bereits bekannt, welche Werkzeuge griffen, und ein Mitschnitt jeder
 * Frage wäre ein wachsendes Tätigkeitsprotokoll ohne zusätzlichen Nutzen.
 *
 * `reason` trennt Fälle, die in der Antwort gleich aussehen — eine
 * Werkzeuglücke von einer Betriebsstörung. Ohne die Spalte würde ein nicht
 * erreichbares Modell als Werkzeugbedarf gezählt.
 */
export const assistantUnanswered = sqliteTable("assistant_unanswered", {
  id: id(),
  question: text("question").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at"),
}, (table) => [index("assistant_unanswered_reason_idx").on(table.reason, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
