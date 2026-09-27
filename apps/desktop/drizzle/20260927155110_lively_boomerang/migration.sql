CREATE TABLE `session_live_cursor` (
	`session_id` text PRIMARY KEY,
	`sequence` integer NOT NULL,
	CONSTRAINT `fk_session_live_cursor_session_id_session_argo_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`argo_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session_live_event` (
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`payload` text NOT NULL,
	CONSTRAINT `session_live_event_pk` PRIMARY KEY(`session_id`, `sequence`),
	CONSTRAINT `fk_session_live_event_session_id_session_argo_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`argo_id`) ON DELETE CASCADE
);
