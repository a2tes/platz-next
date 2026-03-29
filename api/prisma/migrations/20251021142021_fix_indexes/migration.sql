-- DropForeignKey
ALTER TABLE `work_revisions` DROP FOREIGN KEY `work_revisions_work_id_fkey`;

-- DropIndex
DROP INDEX `work_revisions_work_id_created_at_idx` ON `work_revisions`;

-- DropIndex
DROP INDEX `work_revisions_work_id_version_idx` ON `work_revisions`;

-- CreateIndex
CREATE INDEX `work_revisions_work_id_idx` ON `work_revisions`(`work_id`);

-- CreateIndex
CREATE INDEX `work_revisions_work_id_version_idx` ON `work_revisions`(`work_id`, `version`);

-- Removed redundant FK creation to avoid duplicate key errors in shadow DB.
