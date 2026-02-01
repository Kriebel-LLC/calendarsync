-- Airtable OAuth connections table
CREATE TABLE `airtable_connections` (
  `id` text(191) PRIMARY KEY NOT NULL,
  `org_id` text(191) NOT NULL,
  `airtable_user_id` text(191) NOT NULL,
  `access_token` text NOT NULL,
  `refresh_token` text NOT NULL,
  `expires_at` integer NOT NULL,
  `refresh_expires_at` integer NOT NULL,
  `scopes` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE UNIQUE INDEX `airtable_connections_org_user_id_key` ON `airtable_connections` (`org_id`, `airtable_user_id`);

-- Add Airtable columns to destinations table
ALTER TABLE `destinations` ADD COLUMN `airtable_connection_id` text(191);
ALTER TABLE `destinations` ADD COLUMN `airtable_base_id` text(191);
ALTER TABLE `destinations` ADD COLUMN `airtable_base_name` text(191);
ALTER TABLE `destinations` ADD COLUMN `airtable_table_id` text(191);
ALTER TABLE `destinations` ADD COLUMN `airtable_table_name` text(191);

-- Make google_connection_id nullable (was required before)
-- SQLite doesn't support ALTER COLUMN, so this is handled by Drizzle during generation

-- Add Airtable record ID to synced_events
ALTER TABLE `synced_events` ADD COLUMN `airtable_record_id` text(191);
