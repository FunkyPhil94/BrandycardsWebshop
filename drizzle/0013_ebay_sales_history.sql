-- Phase 9: Verkaufshistorie aus der eBay-Fulfillment-API.
--
-- Zwei Teile: eine neue Tabelle fuer die verkauften Posten, und die
-- Erweiterung der Zustandstabelle um den vierten Datentyp SALES.

-- 1. Die Verkaufsposten.
--
-- **Ohne Fensterloeschung**, anders als die drei Tabellen aus Phase 8. Ein
-- Verkauf ist eine Tatsache und keine Momentaufnahme: Er faellt aus dem
-- Abfragefenster heraus, ohne ungeschehen zu werden. Wuerde hier nach jedem
-- Lauf geloescht, was eBay diesmal nicht mehr zurueckgibt, schrumpfte die
-- Historie still mit dem Fenster mit.
CREATE TABLE IF NOT EXISTS `ebay_sales` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`ebay_order_id` text NOT NULL,
	`line_item_id` text NOT NULL,
	`ebay_item_id` text,
	`title` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`amount_cents` integer,
	`order_total_cents` integer,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`sold_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`collected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
-- Bestellung plus Posten ist der Schluessel: Eine Bestellung kann mehrere
-- Karten enthalten, und derselbe Artikel kann in zwei Bestellungen vorkommen.
CREATE UNIQUE INDEX IF NOT EXISTS `ebay_sales_line_unique` ON `ebay_sales` (`ebay_order_id`, `line_item_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ebay_sales_sold_idx` ON `ebay_sales` (`sold_at`);
--> statement-breakpoint

-- 2. SALES in die Zustandstabelle aufnehmen.
--
-- SQLite kann eine CHECK-Bedingung nicht aendern; die Tabelle muss neu gebaut
-- werden. Die drei bestehenden Zeilen wandern dabei mit -- ohne sie wuesste der
-- Assistant nach der Migration nicht mehr, wann zuletzt erfolgreich abgerufen
-- wurde, und meldete faelschlich NOT_SYNCED.
-- Falls ein frueherer Lauf mittendrin abbrach, liegt die Huelle noch da. Sie
-- zu behalten waere schlimmer als sie wegzuwerfen: Sie truege einen halben
-- Stand, und `IF NOT EXISTS` wuerde ihn stillschweigend weiterverwenden.
DROP TABLE IF EXISTS `ebay_read_syncs_neu`;
--> statement-breakpoint
CREATE TABLE `ebay_read_syncs_neu` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`data_type` text NOT NULL,
	`status` text NOT NULL,
	`last_attempt_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_success_at` text,
	`record_count` integer DEFAULT 0 NOT NULL,
	`detail` text,
	CONSTRAINT "ebay_read_syncs_type_check" CHECK("ebay_read_syncs_neu"."data_type" IN ('TRAFFIC', 'MESSAGES', 'BEST_OFFERS', 'SALES')),
	CONSTRAINT "ebay_read_syncs_status_check" CHECK("ebay_read_syncs_neu"."status" IN ('OK', 'NOT_CONFIGURED', 'SCOPE_NOT_GRANTED', 'RATE_LIMITED', 'UPSTREAM_ERROR'))
);
--> statement-breakpoint
INSERT INTO `ebay_read_syncs_neu` (`id`, `data_type`, `status`, `last_attempt_at`, `last_success_at`, `record_count`, `detail`)
SELECT `id`, `data_type`, `status`, `last_attempt_at`, `last_success_at`, `record_count`, `detail` FROM `ebay_read_syncs`;
--> statement-breakpoint
DROP TABLE `ebay_read_syncs`;
--> statement-breakpoint
ALTER TABLE `ebay_read_syncs_neu` RENAME TO `ebay_read_syncs`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ebay_read_syncs_type_unique` ON `ebay_read_syncs` (`data_type`);
