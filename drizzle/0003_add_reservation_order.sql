ALTER TABLE `reservations` ADD `order_id` text REFERENCES `orders`(`id`) ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reservations_order_idx` ON `reservations` (`order_id`);
