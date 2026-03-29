-- CreateIndex
CREATE INDEX `work_revisions_work_id_version_idx` ON `work_revisions`(`work_id`, `version`);

-- CreateIndex
CREATE INDEX `work_revisions_work_id_created_at_idx` ON `work_revisions`(`work_id`, `created_at`);
