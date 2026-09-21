PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_selection` (
	`singleton` integer PRIMARY KEY,
	`project_id` text,
	CONSTRAINT `fk_project_selection_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`),
	CONSTRAINT "project_selection_singleton" CHECK("singleton" = 1)
);
--> statement-breakpoint
INSERT INTO `__new_project_selection`(`singleton`, `project_id`) SELECT `singleton`, `project_id` FROM `project_selection`;--> statement-breakpoint
DROP TABLE `project_selection`;--> statement-breakpoint
ALTER TABLE `__new_project_selection` RENAME TO `project_selection`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_setup_checkpoint` (
	`project_id` text PRIMARY KEY,
	`worktree_path` text NOT NULL,
	`phase` text NOT NULL,
	`configuration_source` text NOT NULL,
	`document_revision` text NOT NULL,
	CONSTRAINT `fk_project_setup_checkpoint_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`),
	CONSTRAINT "project_setup_checkpoint_phase" CHECK("phase" IN ('editing', 'validating', 'ready', 'failed', 'cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_project_setup_checkpoint`(`project_id`, `worktree_path`, `phase`, `configuration_source`, `document_revision`) SELECT `project_id`, `worktree_path`, `phase`, `configuration_source`, `document_revision` FROM `project_setup_checkpoint`;--> statement-breakpoint
DROP TABLE `project_setup_checkpoint`;--> statement-breakpoint
ALTER TABLE `__new_project_setup_checkpoint` RENAME TO `project_setup_checkpoint`;--> statement-breakpoint
PRAGMA foreign_keys=ON;