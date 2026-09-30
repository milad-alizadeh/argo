ALTER TABLE `session` ADD `list_order_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `session` SET `list_order_at` = coalesce(`activity_at`, `updated_at`);--> statement-breakpoint
ALTER TABLE `session` ADD `activity` text;--> statement-breakpoint
CREATE INDEX `session_list_order` ON `session` (`project_id`,`list_order_at`,`argo_id`);
