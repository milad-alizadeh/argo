CREATE TABLE `project_setup_actor` (
	`project_id` text PRIMARY KEY,
	`checkpoint_version` integer NOT NULL,
	`machine_version` integer NOT NULL,
	`revision` integer NOT NULL,
	`persisted_snapshot` text NOT NULL,
	`receipts` text NOT NULL,
	`saved_at` text NOT NULL,
	CONSTRAINT `fk_project_setup_actor_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`),
	CONSTRAINT "project_setup_actor_checkpoint_version" CHECK("checkpoint_version" = 1),
	CONSTRAINT "project_setup_actor_machine_version" CHECK("machine_version" > 0),
	CONSTRAINT "project_setup_actor_revision" CHECK("revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE `project_setup_effect` (
	`project_id` text PRIMARY KEY,
	`intent_json` text NOT NULL,
	`result_json` text NOT NULL,
	`saved_at` text NOT NULL,
	CONSTRAINT `fk_project_setup_effect_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_setup_recovery` (
	`project_id` text PRIMARY KEY,
	`raw_record` text NOT NULL,
	`reason` text NOT NULL,
	`saved_at` text NOT NULL,
	CONSTRAINT `fk_project_setup_recovery_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`)
);
