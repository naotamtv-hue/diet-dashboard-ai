CREATE TABLE `favorite_workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`name` text NOT NULL,
	`activity` text NOT NULL,
	`durationMin` integer DEFAULT 0 NOT NULL,
	`intensity` text DEFAULT 'medium' NOT NULL,
	`weightKg` text,
	`reps` integer,
	`sets` integer,
	`incline` integer DEFAULT 0 NOT NULL,
	`caloriesBurned` text DEFAULT '0' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `favorite_workouts_user_idx` ON `favorite_workouts` (`userId`);
