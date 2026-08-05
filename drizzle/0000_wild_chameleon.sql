CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata` text,
	`ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `card_submissions` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`user_id` text,
	`guest_email` text NOT NULL,
	`name` text,
	`message` text,
	`requested_amount_cents` integer,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `card_submissions_status_created_idx` ON `card_submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `ebay_listings` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`product_id` text NOT NULL,
	`ebay_item_id` text NOT NULL,
	`ebay_listing_id` text,
	`sku` text,
	`title` text NOT NULL,
	`description_html` text,
	`price_amount_cents` integer,
	`price_currency` text DEFAULT 'EUR' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`quantity_sold` integer DEFAULT 0 NOT NULL,
	`condition_id` text,
	`condition_description` text,
	`listing_type` text DEFAULT 'FIXED_PRICE' NOT NULL,
	`listing_url` text,
	`category_id` text,
	`start_at` text,
	`end_at` text,
	`shipping_data` text,
	`raw_data` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`last_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ebay_listing_quantity_check" CHECK("ebay_listings"."quantity" >= 0 AND "ebay_listings"."quantity_sold" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ebay_item_id_unique` ON `ebay_listings` (`ebay_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ebay_product_unique` ON `ebay_listings` (`product_id`);--> statement-breakpoint
CREATE INDEX `ebay_listing_status_idx` ON `ebay_listings` (`status`);--> statement-breakpoint
CREATE INDEX `ebay_sku_idx` ON `ebay_listings` (`sku`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`product_id` text,
	`user_id` text,
	`guest_email` text NOT NULL,
	`name` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inquiries_status_created_idx` ON `inquiries` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`product_id` text NOT NULL,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`available_quantity` integer DEFAULT 1 NOT NULL,
	`reserved_quantity` integer DEFAULT 0 NOT NULL,
	`sold_quantity` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "inventory_quantities_check" CHECK("inventory"."available_quantity" >= 0 AND "inventory"."reserved_quantity" >= 0 AND "inventory"."sold_quantity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_product_unique` ON `inventory` (`product_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`title_snapshot` text NOT NULL,
	`sku_snapshot` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_amount_cents` integer NOT NULL,
	`total_amount_cents` integer NOT NULL,
	`product_snapshot` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`order_number` text NOT NULL,
	`user_id` text,
	`guest_email` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`subtotal_amount_cents` integer NOT NULL,
	`shipping_amount_cents` integer DEFAULT 0 NOT NULL,
	`total_amount_cents` integer NOT NULL,
	`shipping_address` text,
	`billing_address` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "orders_amounts_check" CHECK("orders"."subtotal_amount_cents" >= 0 AND "orders"."shipping_amount_cents" >= 0 AND "orders"."total_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `orders_user_status_idx` ON `orders` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`order_id` text NOT NULL,
	`provider` text DEFAULT 'PAYPAL' NOT NULL,
	`provider_order_id` text,
	`provider_capture_id` text,
	`status` text DEFAULT 'CREATED' NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`raw_data` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_order_unique` ON `payments` (`provider`,`provider_order_id`);--> statement-breakpoint
CREATE INDEX `payments_order_status_idx` ON `payments` (`order_id`,`status`);--> statement-breakpoint
CREATE TABLE `price_offers` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text,
	`guest_email` text NOT NULL,
	`proposed_amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`message` text,
	`status` text DEFAULT 'NEW' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `price_offers_product_status_idx` ON `price_offers` (`product_id`,`status`);--> statement-breakpoint
CREATE TABLE `product_assets` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`product_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`source_url` text,
	`mime_type` text,
	`byte_size` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_asset_storage_key_unique` ON `product_assets` (`storage_key`);--> statement-breakpoint
CREATE INDEX `product_assets_product_idx` ON `product_assets` (`product_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "products_kind_check" CHECK("products"."kind" IN ('EBAY_SYNCED', 'PRELISTED')),
	CONSTRAINT "products_status_check" CHECK("products"."status" IN ('ACTIVE', 'INACTIVE', 'SOLD'))
);
--> statement-breakpoint
CREATE INDEX `products_kind_status_idx` ON `products` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `products_title_idx` ON `products` (`title`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`product_id` text NOT NULL,
	`inventory_id` text NOT NULL,
	`user_id` text,
	`guest_email` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`released_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reservations_status_check" CHECK("reservations"."status" IN ('ACTIVE', 'RELEASED', 'CONVERTED', 'EXPIRED'))
);
--> statement-breakpoint
CREATE INDEX `reservations_product_status_idx` ON `reservations` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `reservations_expiry_idx` ON `reservations` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sync_events` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`sync_run_id` text NOT NULL,
	`ebay_item_id` text,
	`product_id` text,
	`status` text NOT NULL,
	`message` text,
	`payload` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sync_run_id`) REFERENCES `sync_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sync_events_run_idx` ON `sync_events` (`sync_run_id`);--> statement-breakpoint
CREATE INDEX `sync_events_item_idx` ON `sync_events` (`ebay_item_id`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`source` text DEFAULT 'EBAY' NOT NULL,
	`status` text DEFAULT 'RUNNING' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`finished_at` text,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`deactivated_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `sync_runs_started_idx` ON `sync_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`role` text DEFAULT 'CUSTOMER' NOT NULL,
	`email` text NOT NULL,
	`email_verified_at` text,
	`display_name` text,
	`auth_provider` text,
	`auth_subject` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" IN ('CUSTOMER', 'ADMIN'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_subject_unique` ON `users` (`auth_provider`,`auth_subject`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`provider` text NOT NULL,
	`external_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'RECEIVED' NOT NULL,
	`payload` text,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text,
	`error_message` text,
	CONSTRAINT "webhook_status_check" CHECK("webhook_events"."status" IN ('RECEIVED', 'PROCESSED', 'FAILED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_provider_event_unique` ON `webhook_events` (`provider`,`external_event_id`);--> statement-breakpoint
CREATE INDEX `webhook_status_idx` ON `webhook_events` (`status`);