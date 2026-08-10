ALTER TABLE `orders` ADD `shipped_at` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_carrier` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `completed_at` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelled_at` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `refunded_at` text;
