CREATE TABLE `session_subagent` (
	`session_id` text NOT NULL,
	`subagent_id` text NOT NULL,
	`label` text,
	`state` text NOT NULL,
	CONSTRAINT `session_subagent_pk` PRIMARY KEY(`session_id`, `subagent_id`),
	CONSTRAINT `fk_session_subagent_session_id_session_argo_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`argo_id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `session` ADD `subagents_read_at` integer;