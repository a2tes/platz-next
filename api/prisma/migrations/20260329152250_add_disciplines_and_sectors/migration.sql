-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `disciplines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'UNLISTED') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `purged_at` DATETIME(3) NULL,
    `created_by` INTEGER NULL,

    UNIQUE INDEX `disciplines_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sectors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'UNLISTED') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `purged_at` DATETIME(3) NULL,
    `created_by` INTEGER NULL,

    UNIQUE INDEX `sectors_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_disciplines` (
    `work_id` INTEGER NOT NULL,
    `discipline_id` INTEGER NOT NULL,

    PRIMARY KEY (`work_id`, `discipline_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_sectors` (
    `work_id` INTEGER NOT NULL,
    `sector_id` INTEGER NOT NULL,

    PRIMARY KEY (`work_id`, `sector_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `disciplines` ADD CONSTRAINT `disciplines_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sectors` ADD CONSTRAINT `sectors_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_disciplines` ADD CONSTRAINT `work_disciplines_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_disciplines` ADD CONSTRAINT `work_disciplines_discipline_id_fkey` FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_sectors` ADD CONSTRAINT `work_sectors_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_sectors` ADD CONSTRAINT `work_sectors_sector_id_fkey` FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
