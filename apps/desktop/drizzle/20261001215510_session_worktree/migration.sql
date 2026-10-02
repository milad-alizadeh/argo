-- Moves each Workspace's folder onto the Sessions and drafts that named it, then drops the table.
-- Only a worktree Argo made stays a Session worktree. A Session in an imported worktree keeps that
-- folder as its `cwd` and has no worktree, so archiving it never removes the folder.
-- Migrations run inside one transaction, where `PRAGMA foreign_keys=OFF` does nothing, so dropping
-- `session` cascades into its child tables. Their rows are kept aside and put back after.
ALTER TABLE `project` ADD `new_worktree` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `project` SET `new_worktree` = NOT EXISTS (
	SELECT 1 FROM `workspace`
	WHERE `workspace`.`id` = `project`.`last_workspace_choice` AND `workspace`.`project_id` = `project`.`id`
		AND `workspace`.`kind` IN ('main', 'imported')
);--> statement-breakpoint
ALTER TABLE `project` DROP COLUMN `last_workspace_choice`;--> statement-breakpoint
CREATE TEMP TABLE `__keep_composer_draft` AS
	SELECT `composer_draft`.*, CASE
		WHEN `composer_draft`.`project_id` IS NULL THEN NULL
		WHEN `workspace`.`kind` IN ('main', 'imported') THEN '{"type":"main"}'
		ELSE '{"type":"new","from":null}'
	END AS `worktree_json`
	FROM `composer_draft`
	LEFT JOIN `workspace` ON `workspace`.`id` = `composer_draft`.`workspace_id`;--> statement-breakpoint
CREATE TEMP TABLE `__keep_session_archive` AS SELECT * FROM `session_archive`;--> statement-breakpoint
CREATE TEMP TABLE `__keep_session_subagent` AS SELECT * FROM `session_subagent`;--> statement-breakpoint
CREATE TEMP TABLE `__keep_session_command` AS SELECT `command_id`, `session_id` FROM `session_command`;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`argo_id` text PRIMARY KEY,
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`project_id` text,
	`worktree_path` text,
	`worktree_branch` text,
	`custom_title` text,
	`preview` text,
	`first_prompt` text,
	`cwd` text,
	`activity_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`activity` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`turn_configuration` text,
	`plan_progress` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_session_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL,
	CONSTRAINT "session_worktree" CHECK(("worktree_path" IS NULL) = ("worktree_branch" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_session`(`argo_id`, `harness`, `native_id`, `project_id`, `worktree_path`, `worktree_branch`, `custom_title`, `preview`, `first_prompt`, `cwd`, `activity_at`, `sort_order`, `activity`, `status`, `turn_configuration`, `plan_progress`, `created_at`, `updated_at`)
	SELECT `session`.`argo_id`, `session`.`harness`, `session`.`native_id`, `session`.`project_id`,
		CASE WHEN `workspace`.`kind` = 'managed' THEN `workspace`.`path` END,
		CASE WHEN `workspace`.`kind` = 'managed' THEN 'argo/' || `workspace`.`display_name` END,
		`session`.`custom_title`, `session`.`preview`, `session`.`first_prompt`,
		CASE WHEN `workspace`.`kind` = 'imported' THEN coalesce(`session`.`cwd`, `workspace`.`path`) ELSE `session`.`cwd` END, `session`.`activity_at`, `session`.`sort_order`, `session`.`activity`, `session`.`status`, `session`.`turn_configuration`, `session`.`plan_progress`, `session`.`created_at`, `session`.`updated_at`
	FROM `session`
	LEFT JOIN `workspace` ON `workspace`.`id` = `session`.`workspace_id`;--> statement-breakpoint
DROP TABLE `composer_draft`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
CREATE UNIQUE INDEX `session_harness_native` ON `session` (`harness`,`native_id`);--> statement-breakpoint
CREATE INDEX `session_list_order` ON `session` (`project_id`,`sort_order`,`created_at`,`argo_id`);--> statement-breakpoint
CREATE TABLE `composer_draft` (
	`id` text PRIMARY KEY,
	`project_id` text,
	`session_id` text,
	`worktree_json` text,
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
	CONSTRAINT "composer_draft_target" CHECK(("project_id" IS NOT NULL) != ("session_id" IS NOT NULL)),
	CONSTRAINT "composer_draft_new_session_fields" CHECK(("project_id" IS NULL AND "worktree_json" IS NULL AND "harness" IS NULL) OR ("project_id" IS NOT NULL AND "worktree_json" IS NOT NULL AND "harness" IS NOT NULL)),
	CONSTRAINT "composer_draft_revision" CHECK("revision" >= 0)
);
--> statement-breakpoint
INSERT INTO `composer_draft`(`id`, `project_id`, `session_id`, `worktree_json`, `harness`, `prompt`, `attachments_json`, `ticket_context_json`, `model`, `effort`, `mode`, `revision`, `created_at`, `updated_at`)
	SELECT `id`, `project_id`, `session_id`, `worktree_json`, `harness`, `prompt`, `attachments_json`, `ticket_context_json`, `model`, `effort`, `mode`, `revision`, `created_at`, `updated_at` FROM `__keep_composer_draft`;--> statement-breakpoint
CREATE UNIQUE INDEX `composer_draft_project` ON `composer_draft` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `composer_draft_session` ON `composer_draft` (`session_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `session_archive` SELECT * FROM `__keep_session_archive`;--> statement-breakpoint
INSERT OR IGNORE INTO `session_subagent` SELECT * FROM `__keep_session_subagent`;--> statement-breakpoint
UPDATE `session_command` SET `session_id` = (
	SELECT `__keep_session_command`.`session_id` FROM `__keep_session_command`
	WHERE `__keep_session_command`.`command_id` = `session_command`.`command_id`
);--> statement-breakpoint
DROP TABLE `workspace`;--> statement-breakpoint
DROP TABLE `__keep_composer_draft`;--> statement-breakpoint
DROP TABLE `__keep_session_archive`;--> statement-breakpoint
DROP TABLE `__keep_session_subagent`;--> statement-breakpoint
DROP TABLE `__keep_session_command`;
