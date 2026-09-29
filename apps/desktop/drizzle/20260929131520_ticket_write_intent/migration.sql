CREATE TABLE `ticket_write_intent` (
	`intent_id` text PRIMARY KEY,
	`ticket_id` text NOT NULL,
	`operation` text NOT NULL,
	`requested_json` text NOT NULL,
	`base_updated_at` integer NOT NULL,
	`phase` text NOT NULL,
	`failure` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_ticket_write_intent_ticket_id_ticket_argo_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`argo_id`) ON DELETE CASCADE
);
