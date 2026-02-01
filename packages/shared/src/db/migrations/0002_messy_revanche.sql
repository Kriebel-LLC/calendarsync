CREATE TABLE `calendar_connections` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`google_email` text(191) NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_expires_at` integer NOT NULL,
	`selected_calendar_ids` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `destinations` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`name` text(191) NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_configs` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`calendar_connection_id` text(191) NOT NULL,
	`destination_id` text(191) NOT NULL,
	`name` text(191) NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`field_mapping` text NOT NULL,
	`filters` text,
	`sync_interval_minutes` integer DEFAULT 60 NOT NULL,
	`lookback_days` integer DEFAULT 7 NOT NULL,
	`lookahead_days` integer DEFAULT 30 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_history` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`sync_config_id` text(191) NOT NULL,
	`status` text NOT NULL,
	`events_processed` integer DEFAULT 0 NOT NULL,
	`events_created` integer DEFAULT 0 NOT NULL,
	`events_updated` integer DEFAULT 0 NOT NULL,
	`events_deleted` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
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
CREATE INDEX `calendar_connections_user_id_idx` ON `calendar_connections` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_connections_user_email_key` ON `calendar_connections` (`user_id`,`google_email`);--> statement-breakpoint
CREATE INDEX `destinations_user_id_idx` ON `destinations` (`user_id`);--> statement-breakpoint
CREATE INDEX `sync_configs_user_id_idx` ON `sync_configs` (`user_id`);--> statement-breakpoint
CREATE INDEX `sync_configs_calendar_connection_id_idx` ON `sync_configs` (`calendar_connection_id`);--> statement-breakpoint
CREATE INDEX `sync_configs_destination_id_idx` ON `sync_configs` (`destination_id`);--> statement-breakpoint
CREATE INDEX `sync_history_sync_config_id_idx` ON `sync_history` (`sync_config_id`);--> statement-breakpoint
CREATE INDEX `sync_history_started_at_idx` ON `sync_history` (`started_at`);