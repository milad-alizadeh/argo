ALTER TABLE `managed_workspace_recovery` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `managed_workspace_recovery` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_selection` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_selection` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_setup_actor` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_setup_actor` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_setup_checkpoint` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_setup_checkpoint` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_setup_effect` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_setup_effect` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_setup_recovery` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_setup_recovery` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_workspace_selection` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_workspace_selection` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `workspace` ADD `created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `workspace` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
ALTER TABLE `session_ticket_link` ADD `updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_ticket_link` (
	`session_id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`ticket_key` text NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_session_ticket_link`(`session_id`, `project_id`, `ticket_key`, `title`, `state`, `created_at`) SELECT `session_id`, `project_id`, `ticket_key`, `title`, `state`, `created_at` FROM `session_ticket_link`;--> statement-breakpoint
DROP TABLE `session_ticket_link`;--> statement-breakpoint
ALTER TABLE `__new_session_ticket_link` RENAME TO `session_ticket_link`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`argo_id` text PRIMARY KEY,
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`project_id` text,
	`custom_title` text,
	`preview` text,
	`first_prompt` text,
	`cwd` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_session_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_session`(`argo_id`, `harness`, `native_id`, `project_id`, `custom_title`, `preview`, `first_prompt`, `cwd`, `created_at`, `updated_at`) SELECT `argo_id`, `harness`, `native_id`, `project_id`, `custom_title`, `preview`, `first_prompt`, `cwd`, `created_at`, `updated_at` FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `session_ticket_link_ticket` ON `session_ticket_link` (`project_id`,`ticket_key`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_harness_native` ON `session` (`harness`,`native_id`);