CREATE TABLE `session_preference` (
	`argo_id` text PRIMARY KEY,
	`archived` integer DEFAULT false NOT NULL,
	`argo_title` text
);
