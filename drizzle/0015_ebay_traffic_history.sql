-- Aufrufe je Karte und Tag: die Historie.
--
-- Am 2026-08-17 gefragt: "Welche Karten hatten in Zeitraum X die meisten
-- Aufrufe, welche kaum oder keine?" -- und nicht beantwortbar gewesen.
-- `ebay_listing_traffic` haelt genau eine Zeile je Karte mit einem rollierenden
-- 30-Tage-Fenster und wird bei jedem Lauf ueberschrieben. Es gab keine Zeitachse.
--
-- **Ohne Fensterloeschung**, wie `ebay_sales` und anders als die drei Tabellen
-- aus Phase 8: Ein Tageswert ist eine Tatsache und wird nicht ungeschehen,
-- wenn er aus einem Abfragefenster faellt.
--
-- **Warum je Tag ein eigener Abruf und nicht die Differenz zweier Tagesstaende.**
-- eBay liefert ein rollierendes Fenster. Zwischen zwei Abrufen faellt am
-- hinteren Ende so viel heraus, wie vorn hinzukommt; die Differenz waere keine
-- Tageszahl, sondern eine Erfindung. `getTrafficReport` wird deshalb mit
-- start == end aufgerufen.
CREATE TABLE IF NOT EXISTS `ebay_listing_traffic_daily` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`ebay_item_id` text NOT NULL,
	`day` text NOT NULL,
	`views_total` integer,
	`impressions_total` integer,
	`collected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
-- Ein Tag je Karte genau einmal. Der Nachholvorgang schreibt dieselben Tage
-- mehrfach und korrigiert eBays Nachzuegler ueber diesen Schluessel.
CREATE UNIQUE INDEX IF NOT EXISTS `ebay_listing_traffic_daily_unique` ON `ebay_listing_traffic_daily` (`ebay_item_id`, `day`);
--> statement-breakpoint
-- "Welche Karte in Zeitraum X" liest ueber den Tag und summiert je Karte.
CREATE INDEX IF NOT EXISTS `ebay_listing_traffic_daily_day_idx` ON `ebay_listing_traffic_daily` (`day`, `views_total`);
