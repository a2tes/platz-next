-- AlterTable: Add EXTERNAL_LINK support to presentation_items
ALTER TABLE `presentation_items` MODIFY COLUMN `itemType` ENUM('WORK','ANIMATION','PHOTOGRAPHY','EXTERNAL_LINK') NOT NULL;
ALTER TABLE `presentation_items` ADD COLUMN `external_url` VARCHAR(191) NULL;
ALTER TABLE `presentation_items` ADD COLUMN `external_title` VARCHAR(191) NULL;
ALTER TABLE `presentation_items` ADD COLUMN `external_description` TEXT NULL;
ALTER TABLE `presentation_items` ADD COLUMN `external_thumbnail_id` INT NULL;
ALTER TABLE `presentation_items` ADD CONSTRAINT `fk_presentation_items_external_thumbnail` FOREIGN KEY (`external_thumbnail_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL;
