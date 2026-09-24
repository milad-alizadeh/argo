ALTER TABLE `session` ADD `vendor_title` text;--> statement-breakpoint
ALTER TABLE `session` ADD `working_directory` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`argo_id` text PRIMARY KEY,
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`project_id` text,
	`vendor_title` text,
	`working_directory` text,
	`first_prompt` text,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_session_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_session`(`argo_id`, `project_id`, `harness`, `native_id`, `first_prompt`, `updated_at`) SELECT `argo_id`, `project_id`, `harness`, `native_id`, `first_prompt`, `updated_at` FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `session_harness_native` ON `session` (`harness`,`native_id`);--> statement-breakpoint
DROP TABLE `managed_session_lease`;