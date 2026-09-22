CREATE TABLE `project` (
	`id` text PRIMARY KEY,
	`path` text NOT NULL,
	`common_directory` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `project_selection` (
	`singleton` integer PRIMARY KEY,
	`project_id` text,
	CONSTRAINT `fk_project_selection_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_setup_checkpoint` (
	`project_id` text PRIMARY KEY,
	`worktree_path` text NOT NULL,
	`phase` text NOT NULL,
	`configuration_source` text NOT NULL,
	`document_revision` text NOT NULL,
	CONSTRAINT `fk_project_setup_checkpoint_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_ticket_link` (
	`session_id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`ticket_key` text NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_ticket_link_ticket` ON `session_ticket_link` (`project_id`,`ticket_key`,`created_at`);