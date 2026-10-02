-- Keys each Subagent by its Harness and native ID, so one row says a thread is a child even before a
-- saved parent is known (a null parent). Each row takes its parent's Harness; where one Subagent ID
-- sat under two parents, the first saved row is kept.
CREATE TABLE `__new_session_subagent` (
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`parent_session_id` text,
	`label` text,
	`state` text NOT NULL,
	CONSTRAINT `session_subagent_pk` PRIMARY KEY(`harness`, `native_id`),
	CONSTRAINT `fk_session_subagent_parent_session_id_session_argo_id_fk` FOREIGN KEY (`parent_session_id`) REFERENCES `session`(`argo_id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT OR IGNORE INTO `__new_session_subagent`(`harness`, `native_id`, `parent_session_id`, `label`, `state`)
	SELECT `session`.`harness`, `session_subagent`.`subagent_id`, `session_subagent`.`session_id`, `session_subagent`.`label`, `session_subagent`.`state`
	FROM `session_subagent`
	INNER JOIN `session` ON `session`.`argo_id` = `session_subagent`.`session_id`
	ORDER BY `session_subagent`.`rowid`;--> statement-breakpoint
DROP TABLE `session_subagent`;--> statement-breakpoint
ALTER TABLE `__new_session_subagent` RENAME TO `session_subagent`;--> statement-breakpoint
CREATE INDEX `session_subagent_parent` ON `session_subagent` (`parent_session_id`);
