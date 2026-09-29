CREATE TABLE `ticket_search` (
	`provider` text NOT NULL,
	`scope` text NOT NULL,
	`query` text NOT NULL,
	`phase` text NOT NULL,
	`failure` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `ticket_search_pk` PRIMARY KEY(`provider`, `scope`, `query`)
);
--> statement-breakpoint
CREATE TABLE `ticket_search_ticket_link` (
	`provider` text NOT NULL,
	`scope` text NOT NULL,
	`query` text NOT NULL,
	`ticket_id` text NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `ticket_search_ticket_link_pk` PRIMARY KEY(`provider`, `scope`, `query`, `ticket_id`),
	CONSTRAINT `fk_ticket_search_ticket_link_ticket_id_ticket_argo_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`argo_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `ticket_search_ticket_link_ticket` ON `ticket_search_ticket_link` (`ticket_id`);