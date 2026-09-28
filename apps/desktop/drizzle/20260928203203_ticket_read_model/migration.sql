CREATE TABLE `ticket` (
	`argo_id` text PRIMARY KEY,
	`provider` text NOT NULL,
	`scope` text NOT NULL,
	`native_id` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ticket_content` (
	`ticket_id` text PRIMARY KEY,
	`key` text NOT NULL,
	`url` text,
	`title` text NOT NULL,
	`body` text,
	`state` text NOT NULL,
	`status_json` text NOT NULL,
	`priority_json` text,
	`provider_created_at` text NOT NULL,
	`labels_json` text NOT NULL,
	`type` text,
	`children_json` text NOT NULL,
	`blocked_by_json` text,
	`position` integer,
	`listed_at` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_ticket_content_ticket_id_ticket_argo_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`argo_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `ticket_sync` (
	`provider` text NOT NULL,
	`scope` text NOT NULL,
	`kind` text NOT NULL,
	`phase` text NOT NULL,
	`failure` text,
	`statuses_json` text DEFAULT '[]' NOT NULL,
	`scan_started_at` integer NOT NULL,
	`complete_scan_started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `ticket_sync_pk` PRIMARY KEY(`provider`, `scope`, `kind`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_provider_scope_native` ON `ticket` (`provider`,`scope`,`native_id`);--> statement-breakpoint
CREATE INDEX `ticket_content_listed` ON `ticket_content` (`listed_at`,`position`);