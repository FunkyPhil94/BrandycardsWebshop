CREATE TABLE IF NOT EXISTS `avatar_events` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload` text,
	`dedupe_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "avatar_event_type_check" CHECK("avatar_events"."event_type" IN ('OFFER_RECEIVED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'CARD_SOLD'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `avatar_events_dedupe_unique` ON `avatar_events` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `avatar_events_created_idx` ON `avatar_events` (`created_at`);
