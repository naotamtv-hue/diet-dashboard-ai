CREATE TABLE `ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`usageDate` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_user_date_idx` ON `ai_usage` (`userId`,`usageDate`);
--> statement-breakpoint
CREATE TABLE `ai_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cacheKey` text NOT NULL,
	`resultJson` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_cache_key_unique` ON `ai_cache` (`cacheKey`);
