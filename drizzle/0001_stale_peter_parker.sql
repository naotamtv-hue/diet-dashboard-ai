CREATE TABLE `convenience_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chain` enum('seven','familymart','lawson') NOT NULL,
	`category` enum('bento','onigiri','bread','salad','noodle','hotsnack','drink','dessert','sideDish','proteinSnack') NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`calories` decimal(7,1) NOT NULL,
	`proteinG` decimal(6,1) NOT NULL,
	`fatG` decimal(6,1) NOT NULL,
	`carbsG` decimal(6,1) NOT NULL,
	`priceYen` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `convenience_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gender` enum('male','female') NOT NULL,
	`age` int NOT NULL,
	`heightCm` decimal(5,1) NOT NULL,
	`currentWeightKg` decimal(5,2) NOT NULL,
	`targetWeightKg` decimal(5,2) NOT NULL,
	`targetWeeks` int NOT NULL,
	`activityLevel` enum('sedentary','light','moderate','active','veryActive') NOT NULL,
	`bmr` decimal(7,1) NOT NULL,
	`tdee` decimal(7,1) NOT NULL,
	`targetCalories` decimal(7,1) NOT NULL,
	`weeklyLossKg` decimal(4,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `goals_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mealDate` date NOT NULL,
	`mealType` enum('breakfast','lunch','dinner','snack') NOT NULL,
	`description` text,
	`imageUrl` text,
	`calories` decimal(7,1) NOT NULL DEFAULT '0',
	`proteinG` decimal(6,1) NOT NULL DEFAULT '0',
	`fatG` decimal(6,1) NOT NULL DEFAULT '0',
	`carbsG` decimal(6,1) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recordDate` date NOT NULL,
	`weightKg` decimal(5,2) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recordDate` date NOT NULL,
	`activity` varchar(120) NOT NULL,
	`durationMin` int NOT NULL,
	`intensity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`caloriesBurned` decimal(7,1),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `conv_chain_category_idx` ON `convenience_items` (`chain`,`category`);--> statement-breakpoint
CREATE INDEX `meals_user_date_idx` ON `meals` (`userId`,`mealDate`);--> statement-breakpoint
CREATE INDEX `weights_user_date_idx` ON `weights` (`userId`,`recordDate`);--> statement-breakpoint
CREATE INDEX `workouts_user_date_idx` ON `workouts` (`userId`,`recordDate`);