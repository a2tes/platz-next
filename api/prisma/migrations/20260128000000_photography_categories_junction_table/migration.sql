-- CreateTable: photography_categories junction table
CREATE TABLE `photography_categories` (
    `photography_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,

    PRIMARY KEY (`photography_id`, `category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing category_id data to junction table
INSERT IGNORE INTO `photography_categories` (`photography_id`, `category_id`)
SELECT `id`, `category_id` FROM `photography` WHERE `category_id` IS NOT NULL;

-- DropForeignKey
ALTER TABLE `photography` DROP FOREIGN KEY `photography_category_id_fkey`;

-- DropColumn
ALTER TABLE `photography` DROP COLUMN `category_id`;

-- AddForeignKey
ALTER TABLE `photography_categories` ADD CONSTRAINT `photography_categories_photography_id_fkey` FOREIGN KEY (`photography_id`) REFERENCES `photography`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photography_categories` ADD CONSTRAINT `photography_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `photo_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
