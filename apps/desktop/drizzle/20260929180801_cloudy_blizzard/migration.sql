CREATE TABLE `session_archive` (
	`session_id` text PRIMARY KEY,
	CONSTRAINT `fk_session_archive_session_id_session_argo_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`argo_id`) ON DELETE CASCADE
);
