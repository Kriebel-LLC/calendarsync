CREATE TABLE `org_invites` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`email` text(191) NOT NULL,
	`token` text(191) NOT NULL,
	`expires` integer NOT NULL,
	`sender_user_id` text(191) NOT NULL,
	`org_id` text(191) NOT NULL,
	`role` text DEFAULT 'read' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `org_users` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'read' NOT NULL,
	`org_id` text(191) NOT NULL,
	`user_id` text(191) NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`name` text(191) NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text(191),
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`title` text(191) NOT NULL,
	`content` text,
	`published` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`authorId` text(191) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`stripe_customer_id` text(191),
	`stripe_subscription_id` text(191),
	`stripe_price_id` text(191),
	`stripe_current_period_end` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_org_invites_id_key` ON `org_invites` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_stripe_customer_id_key` ON `orgs` (`stripe_customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_name_id_key` ON `orgs` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_stripe_customer_id_key` ON `users` (`stripe_customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_stripe_subscription_id_key` ON `users` (`stripe_subscription_id`);