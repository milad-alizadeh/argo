DROP TABLE `session`;--> statement-breakpoint
CREATE TABLE `session` (
	`argo_id` text PRIMARY KEY,
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`project_id` text,
	`custom_title` text,
	`preview` text,
	`first_prompt` text,
	`cwd` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_session_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `session_harness_native` ON `session` (`harness`,`native_id`);--> statement-breakpoint
CREATE TRIGGER `session_touch_updated_at`
AFTER UPDATE ON `session`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `session`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `argo_id` = NEW.`argo_id`;
END;--> statement-breakpoint
DROP TABLE `managed_session_lease`;
