-- AlterTable
ALTER TABLE `content_pages` ADD COLUMN `content_blocks` JSON NULL;

-- AlterTable
ALTER TABLE `photo_categories` ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;
