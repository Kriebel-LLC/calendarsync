CREATE TABLE `oauth_credentials` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`provider` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` integer,
	`scope` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_configs` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`name` text(191) NOT NULL,
	`calendar_id` text(191) NOT NULL,
	`calendar_name` text(191),
	`destination_type` text NOT NULL,
	`destination_id` text(191) NOT NULL,
	`destination_name` text(191),
	`sync_frequency` text DEFAULT 'daily' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sync_token` text,
	`next_sync_at` integer,
	`last_sync_at` integer,
	`last_error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_history` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`sync_config_id` text(191) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`events_processed` integer DEFAULT 0,
	`events_created` integer DEFAULT 0,
	`events_updated` integer DEFAULT 0,
	`events_deleted` integer DEFAULT 0,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
/*
 SQLite does not support "Set default to column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_credentials_user_provider_idx` ON `oauth_credentials` (`user_id`,`provider`);--> statement-breakpoint
CREATE INDEX `sync_configs_user_id_idx` ON `sync_configs` (`user_id`);--> statement-breakpoint
CREATE INDEX `sync_configs_next_sync_at_idx` ON `sync_configs` (`next_sync_at`);--> statement-breakpoint
CREATE INDEX `sync_configs_status_idx` ON `sync_configs` (`status`);--> statement-breakpoint
CREATE INDEX `sync_history_sync_config_id_idx` ON `sync_history` (`sync_config_id`);--> statement-breakpoint
CREATE INDEX `sync_history_status_idx` ON `sync_history` (`status`);