-- Custom SQL migration file, put your code below! --
CREATE TRIGGER `managed_workspace_recovery_touch_updated_at`
AFTER UPDATE ON `managed_workspace_recovery`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `managed_workspace_recovery`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `workspace_id` = NEW.`workspace_id`;
END;--> statement-breakpoint
CREATE TRIGGER `project_touch_updated_at`
AFTER UPDATE ON `project`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `project`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `project_selection_touch_updated_at`
AFTER UPDATE ON `project_selection`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `project_selection`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `singleton` = NEW.`singleton`;
END;--> statement-breakpoint
CREATE TRIGGER `project_setup_actor_touch_updated_at`
AFTER UPDATE ON `project_setup_actor`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `project_setup_actor`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `project_id` = NEW.`project_id`;
END;--> statement-breakpoint
CREATE TRIGGER `project_setup_checkpoint_touch_updated_at`
AFTER UPDATE ON `project_setup_checkpoint`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `project_setup_checkpoint`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `project_id` = NEW.`project_id`;
END;--> statement-breakpoint
CREATE TRIGGER `project_setup_effect_touch_updated_at`
AFTER UPDATE ON `project_setup_effect`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `project_setup_effect`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `project_id` = NEW.`project_id`;
END;--> statement-breakpoint
CREATE TRIGGER `project_setup_recovery_touch_updated_at`
AFTER UPDATE ON `project_setup_recovery`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `project_setup_recovery`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `project_id` = NEW.`project_id`;
END;--> statement-breakpoint
CREATE TRIGGER `project_workspace_selection_touch_updated_at`
AFTER UPDATE ON `project_workspace_selection`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `project_workspace_selection`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `project_id` = NEW.`project_id`;
END;--> statement-breakpoint
CREATE TRIGGER `session_touch_updated_at`
AFTER UPDATE ON `session`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `session`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `argo_id` = NEW.`argo_id`;
END;--> statement-breakpoint
CREATE TRIGGER `session_ticket_link_touch_updated_at`
AFTER UPDATE ON `session_ticket_link`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `session_ticket_link`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `session_id` = NEW.`session_id`;
END;--> statement-breakpoint
CREATE TRIGGER `workspace_touch_updated_at`
AFTER UPDATE ON `workspace`
FOR EACH ROW
WHEN NEW.`updated_at` <= OLD.`updated_at`
BEGIN
	UPDATE `workspace`
	SET `updated_at` = MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), OLD.`updated_at` + 1)
	WHERE `id` = NEW.`id`;
END;
