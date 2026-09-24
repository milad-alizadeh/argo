CREATE TABLE `development_project_selection` (
	`instance_id` text PRIMARY KEY,
	`project_id` text,
	CONSTRAINT `fk_development_project_selection_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`)
);
