-- AlterTable
ALTER TABLE `photographers` ADD COLUMN `cover_image_id` INTEGER NULL,
    ADD COLUMN `meta_description` TEXT NULL,
    ADD COLUMN `meta_keywords` TEXT NULL,
    ADD COLUMN `og_image_id` INTEGER NULL,
    ADD COLUMN `published_at` DATETIME(3) NULL,
    ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `tags` JSON NULL,
    ADD COLUMN `twitter_image_id` INTEGER NULL;

-- Update existing rows to have empty JSON array for tags
UPDATE `photographers` SET `tags` = JSON_ARRAY() WHERE `tags` IS NULL;

-- Make tags NOT NULL after setting defaults
ALTER TABLE `photographers` MODIFY COLUMN `tags` JSON NOT NULL;

-- AddForeignKey
ALTER TABLE `photographers` ADD CONSTRAINT `photographers_cover_image_id_fkey` FOREIGN KEY (`cover_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photographers` ADD CONSTRAINT `photographers_og_image_id_fkey` FOREIGN KEY (`og_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photographers` ADD CONSTRAINT `photographers_twitter_image_id_fkey` FOREIGN KEY (`twitter_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
