ALTER TABLE `ticket_content` ADD `closed_position` integer;--> statement-breakpoint
ALTER TABLE `ticket_sync` ADD `next_cursor` text;--> statement-breakpoint
CREATE INDEX `ticket_content_closed` ON `ticket_content` (`closed_position`);