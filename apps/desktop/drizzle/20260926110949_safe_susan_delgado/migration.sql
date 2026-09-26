CREATE TABLE `session_sync_status` (
	`harness` text PRIMARY KEY,
	`phase` text NOT NULL,
	`processed` integer NOT NULL,
	`total` integer,
	`skipped` integer NOT NULL,
	`last_successful_sync_at` integer,
	`failure` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
