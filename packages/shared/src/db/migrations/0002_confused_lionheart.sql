/*
 SQLite does not support "Set default to column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/--> statement-breakpoint
ALTER TABLE orgs ADD `stripe_subscription_id` text(191);--> statement-breakpoint
ALTER TABLE orgs ADD `stripe_current_period_end` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_stripe_subscription_id_key` ON `orgs` (`stripe_subscription_id`);