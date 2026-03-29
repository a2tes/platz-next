-- CreateTable
CREATE TABLE `page_seo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `page_key` VARCHAR(191) NOT NULL,
    `title` TEXT NULL,
    `meta_description` TEXT NULL,
    `meta_keywords` TEXT NULL,
    `og_image_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `page_seo_page_key_key`(`page_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: Add SEO fields to directors
ALTER TABLE `directors` ADD COLUMN `meta_description` TEXT NULL;
ALTER TABLE `directors` ADD COLUMN `meta_keywords` TEXT NULL;
ALTER TABLE `directors` ADD COLUMN `og_image_id` INTEGER NULL;

-- AlterTable: Add SEO fields to photo_categories
ALTER TABLE `photo_categories` ADD COLUMN `meta_description` TEXT NULL;
ALTER TABLE `photo_categories` ADD COLUMN `meta_keywords` TEXT NULL;
ALTER TABLE `photo_categories` ADD COLUMN `og_image_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `page_seo` ADD CONSTRAINT `page_seo_og_image_id_fkey` FOREIGN KEY (`og_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `directors` ADD CONSTRAINT `directors_og_image_id_fkey` FOREIGN KEY (`og_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photo_categories` ADD CONSTRAINT `photo_categories_og_image_id_fkey` FOREIGN KEY (`og_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
