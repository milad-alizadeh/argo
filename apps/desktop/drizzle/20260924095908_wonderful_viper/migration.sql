CREATE TABLE `session` (
	`argo_id` text PRIMARY KEY,
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`title` text,
	`first_prompt` text,
	`updated_at` integer NOT NULL
);
