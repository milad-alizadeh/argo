ALTER TABLE `project` ADD `last_workspace_choice` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspace` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`path` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_workspace_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT "workspace_kind" CHECK("kind" IN ('main', 'imported', 'managed')),
	CONSTRAINT "workspace_display_name" CHECK(length("display_name") > 0)
);
--> statement-breakpoint
INSERT INTO `__new_workspace`(`id`, `project_id`, `kind`, `display_name`, `path`, `created_at`, `updated_at`) SELECT `id`, `project_id`, `kind`, `display_name`, `path`, `created_at`, `updated_at` FROM `workspace`;--> statement-breakpoint
DROP TABLE `workspace`;--> statement-breakpoint
ALTER TABLE `__new_workspace` RENAME TO `workspace`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_composer_draft` (
	`id` text PRIMARY KEY,
	`project_id` text,
	`session_id` text,
	`workspace_id` text,
	`harness` text,
	`prompt` text DEFAULT '' NOT NULL,
	`attachments_json` text DEFAULT '[]' NOT NULL,
	`ticket_context_json` text DEFAULT '[]' NOT NULL,
	`model` text NOT NULL,
	`effort` text NOT NULL,
	`mode` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_composer_draft_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_composer_draft_session_id_session_argo_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`argo_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_composer_draft_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE,
	CONSTRAINT "composer_draft_target" CHECK(("project_id" IS NOT NULL) != ("session_id" IS NOT NULL)),
	CONSTRAINT "composer_draft_new_session_fields" CHECK(("project_id" IS NULL AND "workspace_id" IS NULL AND "harness" IS NULL) OR ("project_id" IS NOT NULL AND "harness" IS NOT NULL)),
	CONSTRAINT "composer_draft_revision" CHECK("revision" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_composer_draft`(`id`, `project_id`, `session_id`, `workspace_id`, `harness`, `prompt`, `attachments_json`, `ticket_context_json`, `model`, `effort`, `mode`, `revision`, `created_at`, `updated_at`) SELECT `id`, `project_id`, `session_id`, `workspace_id`, `harness`, `prompt`, `attachments_json`, `ticket_context_json`, `model`, `effort`, `mode`, `revision`, `created_at`, `updated_at` FROM `composer_draft`;--> statement-breakpoint
DROP TABLE `composer_draft`;--> statement-breakpoint
ALTER TABLE `__new_composer_draft` RENAME TO `composer_draft`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `composer_draft_project` ON `composer_draft` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `composer_draft_session` ON `composer_draft` (`session_id`);