CREATE TABLE `session_command` (
	`command_id` text PRIMARY KEY,
	`session_id` text,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_session_command_session_id_session_argo_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`argo_id`) ON DELETE SET NULL
);
