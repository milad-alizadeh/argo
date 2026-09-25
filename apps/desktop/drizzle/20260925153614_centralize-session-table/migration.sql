DROP TABLE `session`;--> statement-breakpoint
CREATE TABLE `session` (
	`argo_id` text PRIMARY KEY,
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`project_id` text,
	`custom_title` text,
	`vendor_preview` text,
	`first_prompt` text,
	`cwd` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_session_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `session_harness_native` ON `session` (`harness`,`native_id`);--> statement-breakpoint
DROP TABLE `managed_session_lease`;
