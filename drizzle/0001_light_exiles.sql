CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`bodyPart` text NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exercises_user_idx` ON `exercises` (`userId`,`bodyPart`);--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`recordDate` text NOT NULL,
	`bodyPart` text NOT NULL,
	`exerciseName` text NOT NULL,
	`setNo` integer NOT NULL,
	`weightKg` text,
	`reps` integer,
	`memo` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workout_sets_user_date_idx` ON `workout_sets` (`userId`,`recordDate`);