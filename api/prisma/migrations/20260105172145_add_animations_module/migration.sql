-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `animations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `short_description` TEXT NULL,
    `client` VARCHAR(191) NOT NULL,
    `agency` VARCHAR(191) NULL,
    `tags` JSON NOT NULL,
    `video_file_id` INTEGER NULL,
    `meta_description` TEXT NULL,
    `meta_keywords` TEXT NULL,
    `preview_image_id` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'UNLISTED') NOT NULL DEFAULT 'DRAFT',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `published_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `purged_at` DATETIME(3) NULL,

    UNIQUE INDEX `animations_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `animation_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `animation_id` INTEGER NOT NULL,
    `user_id` INTEGER NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `payload` JSON NOT NULL,
    `reverted_from_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `animation_revisions_animation_id_idx`(`animation_id`),
    INDEX `animation_revisions_animation_id_version_idx`(`animation_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `animations` ADD CONSTRAINT `animations_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `animations` ADD CONSTRAINT `animations_video_file_id_fkey` FOREIGN KEY (`video_file_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `animations` ADD CONSTRAINT `animations_preview_image_id_fkey` FOREIGN KEY (`preview_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `animation_revisions` ADD CONSTRAINT `animation_revisions_animation_id_fkey` FOREIGN KEY (`animation_id`) REFERENCES `animations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `animation_revisions` ADD CONSTRAINT `animation_revisions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `animation_revisions` ADD CONSTRAINT `animation_revisions_reverted_from_id_fkey` FOREIGN KEY (`reverted_from_id`) REFERENCES `animation_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
