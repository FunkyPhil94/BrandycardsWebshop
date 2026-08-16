CREATE TABLE IF NOT EXISTS `avatar_device_pairings` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`code_hash` text NOT NULL,
	`created_by_user_id` text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	`expires_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`claimed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `avatar_device_pairings_code_unique` ON `avatar_device_pairings` (`code_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `avatar_device_pairings_expiry_idx` ON `avatar_device_pairings` (`expires_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `avatar_device_tokens` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`token_hash` text NOT NULL,
	`label` text DEFAULT 'BrandyCards Desktop Avatar' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `avatar_device_tokens_hash_unique` ON `avatar_device_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `avatar_device_tokens_revoked_idx` ON `avatar_device_tokens` (`revoked_at`);
