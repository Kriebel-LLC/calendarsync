-- Google OAuth connections table
CREATE TABLE `google_connections` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`org_id` text(191) NOT NULL,
	`email` text(191) NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scopes` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_connections_org_email_key` ON `google_connections` (`org_id`, `email`);
--> statement-breakpoint

-- Destinations table (Google Sheets targets)
CREATE TABLE `destinations` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`org_id` text(191) NOT NULL,
	`google_connection_id` text(191) NOT NULL,
	`type` text NOT NULL,
	`name` text(191) NOT NULL,
	`spreadsheet_id` text(191),
	`spreadsheet_name` text(191),
	`sheet_id` integer,
	`sheet_name` text(191),
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Calendars table (Google Calendar sources)
CREATE TABLE `calendars` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`org_id` text(191) NOT NULL,
	`google_connection_id` text(191) NOT NULL,
	`google_calendar_id` text(191) NOT NULL,
	`name` text(191) NOT NULL,
	`color` text(7),
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Sync configurations table (links calendars to destinations)
CREATE TABLE `sync_configs` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`org_id` text(191) NOT NULL,
	`calendar_id` text(191) NOT NULL,
	`destination_id` text(191) NOT NULL,
	`sync_token` text,
	`last_sync_at` integer,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_configs_cal_dest_key` ON `sync_configs` (`calendar_id`, `destination_id`);
--> statement-breakpoint

-- Synced events table (tracks events for smart updates/deletes)
CREATE TABLE `synced_events` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`sync_config_id` text(191) NOT NULL,
	`google_event_id` text(191) NOT NULL,
	`sheet_row_number` integer,
	`event_hash` text(64),
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `synced_events_sync_event_key` ON `synced_events` (`sync_config_id`, `google_event_id`);
