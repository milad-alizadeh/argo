PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_managed_workspace_recovery` (
	`workspace_id` text PRIMARY KEY,
	`checkout_removed_at` text NOT NULL,
	CONSTRAINT `fk_managed_workspace_recovery_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_managed_workspace_recovery`(`workspace_id`, `checkout_removed_at`) SELECT `workspace_id`, `checkout_removed_at` FROM `managed_workspace_recovery`;--> statement-breakpoint
DROP TABLE `managed_workspace_recovery`;--> statement-breakpoint
ALTER TABLE `__new_managed_workspace_recovery` RENAME TO `managed_workspace_recovery`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_workspace_selection` (
	`project_id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	CONSTRAINT `fk_project_workspace_selection_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_project_workspace_selection_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_project_workspace_selection`(`project_id`, `workspace_id`) SELECT `project_id`, `workspace_id` FROM `project_workspace_selection`;--> statement-breakpoint
DROP TABLE `project_workspace_selection`;--> statement-breakpoint
ALTER TABLE `__new_project_workspace_selection` RENAME TO `project_workspace_selection`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspace` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`path` text NOT NULL,
	`base_ref` text NOT NULL,
	CONSTRAINT `fk_workspace_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT "workspace_kind" CHECK("kind" IN ('main', 'imported', 'managed')),
	CONSTRAINT "workspace_display_name" CHECK(length("display_name") > 0)
);
--> statement-breakpoint
INSERT INTO `__new_workspace`(`id`, `project_id`, `kind`, `display_name`, `path`, `base_ref`) SELECT `id`, `project_id`, `kind`, `display_name`, `path`, `base_ref` FROM `workspace`;--> statement-breakpoint
DROP TABLE `workspace`;--> statement-breakpoint
ALTER TABLE `__new_workspace` RENAME TO `workspace`;--> statement-breakpoint
PRAGMA foreign_keys=ON;