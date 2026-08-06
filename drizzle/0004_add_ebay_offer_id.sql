ALTER TABLE `ebay_listings` ADD `ebay_offer_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ebay_offer_id_idx` ON `ebay_listings` (`ebay_offer_id`);
