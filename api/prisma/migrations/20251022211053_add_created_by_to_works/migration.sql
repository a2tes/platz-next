-- AlterTable
ALTER TABLE `media_files` MODIFY `s3_key` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `work_revisions` ADD COLUMN `reverted_from_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `works` ADD COLUMN `created_by` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `works` ADD CONSTRAINT `works_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_revisions` ADD CONSTRAINT `work_revisions_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_revisions` ADD CONSTRAINT `work_revisions_reverted_from_id_fkey` FOREIGN KEY (`reverted_from_id`) REFERENCES `work_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
