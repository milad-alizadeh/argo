CREATE VIRTUAL TABLE `session_search` USING fts5(
	`harness` UNINDEXED,
	`session_id` UNINDEXED,
	`content`
);
