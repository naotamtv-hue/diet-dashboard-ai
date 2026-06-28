ALTER TABLE `users` ADD `apiToken` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_api_token_idx` ON `users` (`apiToken`);
