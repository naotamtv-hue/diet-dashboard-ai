CREATE TABLE `body_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`recordDate` text NOT NULL,
	`imageUrl` text NOT NULL,
	`weightKg` text,
	`note` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `body_photos_user_date_idx` ON `body_photos` (`userId`,`recordDate`);--> statement-breakpoint
CREATE TABLE `convenience_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chain` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`calories` text NOT NULL,
	`proteinG` text NOT NULL,
	`fatG` text NOT NULL,
	`carbsG` text NOT NULL,
	`priceYen` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conv_chain_category_idx` ON `convenience_items` (`chain`,`category`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`gender` text NOT NULL,
	`age` integer NOT NULL,
	`heightCm` text NOT NULL,
	`currentWeightKg` text NOT NULL,
	`targetWeightKg` text NOT NULL,
	`targetWeeks` integer NOT NULL,
	`activityLevel` text NOT NULL,
	`bmr` text NOT NULL,
	`tdee` text NOT NULL,
	`targetCalories` text NOT NULL,
	`weeklyLossKg` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goals_userId_unique` ON `goals` (`userId`);--> statement-breakpoint
CREATE TABLE `meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`mealDate` text NOT NULL,
	`mealType` text NOT NULL,
	`description` text,
	`imageUrl` text,
	`calories` text DEFAULT '0' NOT NULL,
	`proteinG` text DEFAULT '0' NOT NULL,
	`fatG` text DEFAULT '0' NOT NULL,
	`carbsG` text DEFAULT '0' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meals_user_date_idx` ON `meals` (`userId`,`mealDate`);--> statement-breakpoint
CREATE TABLE `reminder_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`mealEnabled` integer DEFAULT 0 NOT NULL,
	`mealReminderTime` text DEFAULT '20:00' NOT NULL,
	`weightEnabled` integer DEFAULT 0 NOT NULL,
	`weightReminderTime` text DEFAULT '08:00' NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_settings_userId_unique` ON `reminder_settings` (`userId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`passwordHash` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastSignedIn` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
CREATE TABLE `weights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`recordDate` text NOT NULL,
	`weightKg` text NOT NULL,
	`note` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `weights_user_date_idx` ON `weights` (`userId`,`recordDate`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`recordDate` text NOT NULL,
	`activity` text NOT NULL,
	`durationMin` integer DEFAULT 0 NOT NULL,
	`intensity` text DEFAULT 'medium' NOT NULL,
	`weightKg` text,
	`reps` integer,
	`sets` integer,
	`caloriesBurned` text,
	`note` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workouts_user_date_idx` ON `workouts` (`userId`,`recordDate`);