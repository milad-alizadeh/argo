CREATE TABLE `project` (
	`id` text PRIMARY KEY,
	`path` text NOT NULL,
	`common_directory` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`path` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_workspace_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT "workspace_kind" CHECK("kind" IN ('main', 'imported')),
	CONSTRAINT "workspace_display_name" CHECK(length("display_name") > 0)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`argo_id` text PRIMARY KEY,
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`project_id` text,
	`workspace_id` text,
	`custom_title` text,
	`preview` text,
	`first_prompt` text,
	`cwd` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_session_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_session_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `composer_draft` (
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
	CONSTRAINT "composer_draft_new_session_fields" CHECK(("project_id" IS NULL AND "workspace_id" IS NULL AND "harness" IS NULL) OR ("project_id" IS NOT NULL AND "workspace_id" IS NOT NULL AND "harness" IS NOT NULL)),
	CONSTRAINT "composer_draft_revision" CHECK("revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE `session_ticket_link` (
	`session_id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`ticket_key` text NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_harness_native` ON `session` (`harness`,`native_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `composer_draft_project` ON `composer_draft` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `composer_draft_session` ON `composer_draft` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_ticket_link_ticket` ON `session_ticket_link` (`project_id`,`ticket_key`,`created_at`);
