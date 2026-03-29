-- CreateTable
CREATE TABLE `work_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_id` INTEGER NOT NULL,
    `user_id` INTEGER NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `short_description` TEXT NOT NULL,
    `client` VARCHAR(191) NOT NULL,
    `tags` JSON NOT NULL,
    `video_thumbnail_id` INTEGER NULL,
    `video_file_id` INTEGER NULL,
    `meta_description` TEXT NULL,
    `meta_keywords` TEXT NULL,
    `og_image_id` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL,
    `changes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `work_revisions` ADD CONSTRAINT `work_revisions_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_revisions` ADD CONSTRAINT `work_revisions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
