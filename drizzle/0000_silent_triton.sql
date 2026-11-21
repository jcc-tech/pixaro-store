CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`game` text NOT NULL,
	`amount_label` text DEFAULT '' NOT NULL,
	`robux_amount` integer,
	`price` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '上架' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
