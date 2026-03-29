-- AlterTable
ALTER TABLE `work_revisions` MODIFY `version` INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE `works` ADD CONSTRAINT `works_twitter_image_id_fkey` FOREIGN KEY (`twitter_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
