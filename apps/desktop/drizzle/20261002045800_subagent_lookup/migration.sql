CREATE TABLE `parentless_subagent` (
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	CONSTRAINT `parentless_subagent_pk` PRIMARY KEY(`harness`, `native_id`)
);
--> statement-breakpoint
CREATE INDEX `session_subagent_subagent` ON `session_subagent` (`subagent_id`);