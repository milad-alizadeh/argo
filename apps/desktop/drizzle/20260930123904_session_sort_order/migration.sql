ALTER TABLE `session` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `session` ADD `status` text;--> statement-breakpoint
DROP INDEX `session_list_order`;--> statement-breakpoint
UPDATE `session` SET `created_at` = `list_order_at` WHERE `list_order_at` > 0;--> statement-breakpoint
ALTER TABLE `session` DROP COLUMN `list_order_at`;--> statement-breakpoint
CREATE INDEX `session_list_order` ON `session` (`project_id`,`sort_order`,`created_at`,`argo_id`);
