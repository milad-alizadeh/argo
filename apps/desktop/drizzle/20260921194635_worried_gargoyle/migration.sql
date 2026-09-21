CREATE TABLE `managed_session_lease` (
	`harness` text NOT NULL,
	`native_id` text NOT NULL,
	`window_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `managed_session_lease_pk` PRIMARY KEY(`harness`, `native_id`)
);
