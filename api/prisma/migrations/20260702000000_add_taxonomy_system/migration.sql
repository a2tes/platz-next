-- CreateEnum
-- MySQL doesn't need separate enum creation, enums are inline in column definitions

-- CreateTable
CREATE TABLE `taxonomies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('CLIENT', 'SECTOR', 'DISCIPLINE', 'PHOTO_CATEGORY') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'UNLISTED') NOT NULL DEFAULT 'PUBLISHED',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `og_image_id` INTEGER NULL,
    `meta_description` TEXT NULL,
    `meta_keywords` TEXT NULL,
    `metadata` JSON NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `purged_at` DATETIME(3) NULL,

    UNIQUE INDEX `taxonomies_type_slug_key`(`type`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_taxonomies` (
    `work_id` INTEGER NOT NULL,
    `taxonomy_id` INTEGER NOT NULL,

    PRIMARY KEY (`work_id`, `taxonomy_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `photography_taxonomies` (
    `photography_id` INTEGER NOT NULL,
    `taxonomy_id` INTEGER NOT NULL,

    PRIMARY KEY (`photography_id`, `taxonomy_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `animation_taxonomies` (
    `animation_id` INTEGER NOT NULL,
    `taxonomy_id` INTEGER NOT NULL,

    PRIMARY KEY (`animation_id`, `taxonomy_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `taxonomies` ADD CONSTRAINT `taxonomies_og_image_id_fkey` FOREIGN KEY (`og_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `taxonomies` ADD CONSTRAINT `taxonomies_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_taxonomies` ADD CONSTRAINT `work_taxonomies_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_taxonomies` ADD CONSTRAINT `work_taxonomies_taxonomy_id_fkey` FOREIGN KEY (`taxonomy_id`) REFERENCES `taxonomies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photography_taxonomies` ADD CONSTRAINT `photography_taxonomies_photography_id_fkey` FOREIGN KEY (`photography_id`) REFERENCES `photography`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photography_taxonomies` ADD CONSTRAINT `photography_taxonomies_taxonomy_id_fkey` FOREIGN KEY (`taxonomy_id`) REFERENCES `taxonomies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `animation_taxonomies` ADD CONSTRAINT `animation_taxonomies_animation_id_fkey` FOREIGN KEY (`animation_id`) REFERENCES `animations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `animation_taxonomies` ADD CONSTRAINT `animation_taxonomies_taxonomy_id_fkey` FOREIGN KEY (`taxonomy_id`) REFERENCES `taxonomies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
