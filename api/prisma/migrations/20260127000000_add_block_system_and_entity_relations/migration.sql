-- CreateEnum
-- BlockPageType and BlockType enums are handled by Prisma

-- CreateTable: block_pages
CREATE TABLE IF NOT EXISTS `block_pages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'UNLISTED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `block_pages_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: blocks
CREATE TABLE IF NOT EXISTS `blocks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `model_name` VARCHAR(191) NOT NULL,
    `model_id` INTEGER NULL,
    `parent_id` INTEGER NULL,
    `type` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PUBLISHED', 'UNLISTED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `blocks_uuid_key`(`uuid`),
    INDEX `blocks_model_name_model_id_idx`(`model_name`, `model_id`),
    INDEX `blocks_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: clients
CREATE TABLE IF NOT EXISTS `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: agencies
CREATE TABLE IF NOT EXISTS `agencies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `agencies_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: work_clients
CREATE TABLE IF NOT EXISTS `work_clients` (
    `work_id` INTEGER NOT NULL,
    `client_id` INTEGER NOT NULL,

    PRIMARY KEY (`work_id`, `client_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: work_agencies
CREATE TABLE IF NOT EXISTS `work_agencies` (
    `work_id` INTEGER NOT NULL,
    `agency_id` INTEGER NOT NULL,

    PRIMARY KEY (`work_id`, `agency_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: photography_clients
CREATE TABLE IF NOT EXISTS `photography_clients` (
    `photography_id` INTEGER NOT NULL,
    `client_id` INTEGER NOT NULL,

    PRIMARY KEY (`photography_id`, `client_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: photography_agencies
CREATE TABLE IF NOT EXISTS `photography_agencies` (
    `photography_id` INTEGER NOT NULL,
    `agency_id` INTEGER NOT NULL,

    PRIMARY KEY (`photography_id`, `agency_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: photography_starrings
CREATE TABLE IF NOT EXISTS `photography_starrings` (
    `photography_id` INTEGER NOT NULL,
    `starring_id` INTEGER NOT NULL,

    PRIMARY KEY (`photography_id`, `starring_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: animation_clients
CREATE TABLE IF NOT EXISTS `animation_clients` (
    `animation_id` INTEGER NOT NULL,
    `client_id` INTEGER NOT NULL,

    PRIMARY KEY (`animation_id`, `client_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: animation_agencies
CREATE TABLE IF NOT EXISTS `animation_agencies` (
    `animation_id` INTEGER NOT NULL,
    `agency_id` INTEGER NOT NULL,

    PRIMARY KEY (`animation_id`, `agency_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Note: Some columns may already be renamed to *_legacy in certain environments
-- The application code handles both column names

-- Alter photographers.bio from TEXT to JSON (if not already JSON)
ALTER TABLE `photographers` MODIFY COLUMN `bio` JSON NULL;

-- AddForeignKey: blocks -> block_pages
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `block_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: blocks -> blocks (parent)
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `blocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: work_clients
ALTER TABLE `work_clients` ADD CONSTRAINT `work_clients_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `work_clients` ADD CONSTRAINT `work_clients_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: work_agencies
ALTER TABLE `work_agencies` ADD CONSTRAINT `work_agencies_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `work_agencies` ADD CONSTRAINT `work_agencies_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: photography_clients
ALTER TABLE `photography_clients` ADD CONSTRAINT `photography_clients_photography_id_fkey` FOREIGN KEY (`photography_id`) REFERENCES `photography`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `photography_clients` ADD CONSTRAINT `photography_clients_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: photography_agencies
ALTER TABLE `photography_agencies` ADD CONSTRAINT `photography_agencies_photography_id_fkey` FOREIGN KEY (`photography_id`) REFERENCES `photography`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `photography_agencies` ADD CONSTRAINT `photography_agencies_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: photography_starrings
ALTER TABLE `photography_starrings` ADD CONSTRAINT `photography_starrings_photography_id_fkey` FOREIGN KEY (`photography_id`) REFERENCES `photography`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `photography_starrings` ADD CONSTRAINT `photography_starrings_starring_id_fkey` FOREIGN KEY (`starring_id`) REFERENCES `starrings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: animation_clients
ALTER TABLE `animation_clients` ADD CONSTRAINT `animation_clients_animation_id_fkey` FOREIGN KEY (`animation_id`) REFERENCES `animations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `animation_clients` ADD CONSTRAINT `animation_clients_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: animation_agencies
ALTER TABLE `animation_agencies` ADD CONSTRAINT `animation_agencies_animation_id_fkey` FOREIGN KEY (`animation_id`) REFERENCES `animations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `animation_agencies` ADD CONSTRAINT `animation_agencies_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
