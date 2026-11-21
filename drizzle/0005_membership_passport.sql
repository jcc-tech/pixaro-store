CREATE TABLE `member_claims` (
	`member` text NOT NULL,
	`tier` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`member`, `tier`, `kind`),
	FOREIGN KEY (`member`) REFERENCES `members`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `member_sales` (
	`receipt` text PRIMARY KEY NOT NULL,
	`member` text NOT NULL,
	`amount` integer NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member`) REFERENCES `members`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_sales_by_member` ON `member_sales` (`member`);--> statement-breakpoint
CREATE TABLE `members` (
	`code` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`discord_id` text,
	`discord_name` text,
	`link_state` text,
	`link_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_owner_unique` ON `members` (`owner`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_discord_id_unique` ON `members` (`discord_id`);