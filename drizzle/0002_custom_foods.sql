CREATE TABLE `custom_foods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`servingLabel` text DEFAULT '1食' NOT NULL,
	`calories` text DEFAULT '0' NOT NULL,
	`proteinG` text DEFAULT '0' NOT NULL,
	`fatG` text DEFAULT '0' NOT NULL,
	`carbsG` text DEFAULT '0' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `custom_foods_user_idx` ON `custom_foods` (`userId`);
