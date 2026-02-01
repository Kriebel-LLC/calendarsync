CREATE TABLE `calendar_connections` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text NOT NULL,
	`token_expiry` integer NOT NULL,
	`calendar_ids` text DEFAULT '[]' NOT NULL,
	`google_email` text(191),
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_connections_user_id_idx` ON `calendar_connections` (`user_id`);