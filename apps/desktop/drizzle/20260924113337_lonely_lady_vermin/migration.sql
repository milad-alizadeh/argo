CREATE TABLE `session_launch_intent` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`harness` text NOT NULL,
	`prompt` text NOT NULL,
	`created_at` integer NOT NULL,
	`native_id` text,
	`status` text NOT NULL,
	CONSTRAINT `fk_session_launch_intent_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `managed_session_lease` ADD `owner_token` text NOT NULL DEFAULT '';