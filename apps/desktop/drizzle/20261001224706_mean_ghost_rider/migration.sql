ALTER TABLE `session` ADD `parent_native_id` text;
--> statement-breakpoint
UPDATE `session` AS `child`
SET `parent_native_id` = (
	SELECT `parent`.`native_id`
	FROM `session_subagent` AS `link`
	JOIN `session` AS `parent` ON `parent`.`argo_id` = `link`.`session_id`
	WHERE `link`.`subagent_id` = `child`.`native_id` AND `parent`.`harness` = `child`.`harness`
	LIMIT 1
)
WHERE EXISTS (
	SELECT 1 FROM `session_subagent` AS `link`
	JOIN `session` AS `parent` ON `parent`.`argo_id` = `link`.`session_id`
	WHERE `link`.`subagent_id` = `child`.`native_id` AND `parent`.`harness` = `child`.`harness`
);
