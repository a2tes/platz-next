-- AlterTable
ALTER TABLE `content_pages` ADD COLUMN `twitter_image_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `content_pages` ADD CONSTRAINT `content_pages_twitter_image_id_fkey` FOREIGN KEY (`twitter_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
