-- Phase 8: die drei lesenden eBay-Quellen bekommen eine serverseitige Ablage.
--
-- Handgeschrieben wie 0003-0011. `npm run db:generate` scheidet aus, solange
-- drizzle/meta/_journal.json bei 0002 endet -- der Generator diffte gegen einen
-- Schnappschuss von vor acht Migrationen und erzeugte sie alle noch einmal.
--
-- Alles hier ist ein reines CREATE. Keine bestehende Tabelle wird angefasst,
-- damit ein Rueckbau aus vier DROP TABLE besteht und keine Kaskade ausloest.

CREATE TABLE IF NOT EXISTS `ebay_read_syncs` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`data_type` text NOT NULL,
	`status` text NOT NULL,
	`last_attempt_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_success_at` text,
	`record_count` integer DEFAULT 0 NOT NULL,
	`detail` text,
	CONSTRAINT "ebay_read_syncs_type_check" CHECK("ebay_read_syncs"."data_type" IN ('TRAFFIC', 'MESSAGES', 'BEST_OFFERS')),
	CONSTRAINT "ebay_read_syncs_status_check" CHECK("ebay_read_syncs"."status" IN ('OK', 'NOT_CONFIGURED', 'SCOPE_NOT_GRANTED', 'RATE_LIMITED', 'UPSTREAM_ERROR'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ebay_read_syncs_type_unique` ON `ebay_read_syncs` (`data_type`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ebay_listing_traffic` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`ebay_item_id` text NOT NULL,
	`range_start` text NOT NULL,
	`range_end` text NOT NULL,
	`views_total` integer,
	`impressions_total` integer,
	`collected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
-- Das Fenster gehoert in den Schluessel: eBay liefert eine Summe ueber einen
-- Zeitraum, keine Momentaufnahme. Ohne die beiden Datumsspalten wuerde ein Lauf
-- mit neuem Fenster den alten Wert stillschweigend ueberschreiben.
CREATE UNIQUE INDEX IF NOT EXISTS `ebay_listing_traffic_window_unique` ON `ebay_listing_traffic` (`ebay_item_id`, `range_start`, `range_end`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ebay_listing_traffic_rank_idx` ON `ebay_listing_traffic` (`range_end`, `views_total`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ebay_inbox_messages` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`ebay_message_id` text NOT NULL,
	`sender` text,
	`subject` text NOT NULL,
	`ebay_item_id` text,
	`received_at` text,
	`is_read` integer DEFAULT false NOT NULL,
	`collected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ebay_inbox_messages_id_unique` ON `ebay_inbox_messages` (`ebay_message_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ebay_inbox_messages_unread_idx` ON `ebay_inbox_messages` (`is_read`, `received_at`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ebay_buyer_offers` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`best_offer_id` text NOT NULL,
	`ebay_item_id` text NOT NULL,
	`amount_cents` integer,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`quantity` integer,
	`status` text NOT NULL,
	`has_buyer_message` integer DEFAULT false NOT NULL,
	`expires_at` text,
	`collected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ebay_buyer_offers_id_unique` ON `ebay_buyer_offers` (`best_offer_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ebay_buyer_offers_expiry_idx` ON `ebay_buyer_offers` (`expires_at`);
