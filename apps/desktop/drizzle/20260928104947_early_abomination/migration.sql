CREATE TABLE `session_command` (
	`command_id` text PRIMARY KEY,
	`intent_id` text NOT NULL,
	`session_id` text,
	`harness` text NOT NULL,
	`native_id` text,
	`turn_id` text,
	`cwd` text NOT NULL,
	`outcome` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_command_intent` ON `session_command` (`intent_id`);
