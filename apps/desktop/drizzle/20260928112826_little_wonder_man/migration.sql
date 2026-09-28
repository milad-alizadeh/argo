ALTER TABLE `session_command` ADD `intent_id` text;--> statement-breakpoint
ALTER TABLE `session_command` ADD `harness` text;--> statement-breakpoint
ALTER TABLE `session_command` ADD `native_id` text;--> statement-breakpoint
ALTER TABLE `session_command` ADD `turn_id` text;--> statement-breakpoint
ALTER TABLE `session_command` ADD `cwd` text;--> statement-breakpoint
CREATE UNIQUE INDEX `session_command_intent` ON `session_command` (`intent_id`);