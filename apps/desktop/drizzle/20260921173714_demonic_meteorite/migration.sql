CREATE TABLE `managed_workspace_recovery` (
	`workspace_id` text PRIMARY KEY,
	`checkout_removed_at` text NOT NULL,
	CONSTRAINT `fk_managed_workspace_recovery_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_workspace_selection` (
	`project_id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	CONSTRAINT `fk_project_workspace_selection_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`),
	CONSTRAINT `fk_project_workspace_selection_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`path` text NOT NULL,
	`base_ref` text NOT NULL,
	CONSTRAINT `fk_workspace_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`),
	CONSTRAINT "workspace_kind" CHECK("kind" IN ('main', 'imported', 'managed')),
	CONSTRAINT "workspace_display_name" CHECK(length("display_name") > 0)
);
