-- Add Notion connections table
CREATE TABLE `notion_connections` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`workspace_id` text(191),
	`workspace_name` text(191),
	`workspace_icon` text,
	`bot_id` text(191),
	`selected_database_id` text(191),
	`selected_database_name` text(191),
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notion_connections_user_id_key` ON `notion_connections` (`user_id`);
--> statement-breakpoint
-- Add Notion support to destinations table
ALTER TABLE `destinations` ADD COLUMN `notion_connection_id` text(191);
--> statement-breakpoint
ALTER TABLE `destinations` ADD COLUMN `notion_database_id` text(191);
--> statement-breakpoint
ALTER TABLE `destinations` ADD COLUMN `notion_database_name` text(191);
--> statement-breakpoint
-- Add Notion support to synced_events table
ALTER TABLE `synced_events` ADD COLUMN `user_id` text(191);
--> statement-breakpoint
ALTER TABLE `synced_events` ADD COLUMN `notion_page_id` text(191);
--> statement-breakpoint
ALTER TABLE `synced_events` ADD COLUMN `calendar_id` text(191);
--> statement-breakpoint
ALTER TABLE `synced_events` ADD COLUMN `calendar_name` text(191);
--> statement-breakpoint
ALTER TABLE `synced_events` ADD COLUMN `event_title` text;
--> statement-breakpoint
ALTER TABLE `synced_events` ADD COLUMN `event_start` integer;
--> statement-breakpoint
ALTER TABLE `synced_events` ADD COLUMN `event_end` integer;
--> statement-breakpoint
ALTER TABLE `synced_events` ADD COLUMN `last_synced_at` integer DEFAULT (unixepoch()) NOT NULL;
--> statement-breakpoint
-- Rename google_event_id to external_event_id for consistency
ALTER TABLE `synced_events` RENAME COLUMN `google_event_id` TO `external_event_id`;
--> statement-breakpoint
-- Create indexes for Notion lookups
CREATE UNIQUE INDEX `synced_events_user_event_key` ON `synced_events` (`user_id`, `external_event_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `synced_events_notion_page_id_idx` ON `synced_events` (`notion_page_id`);
