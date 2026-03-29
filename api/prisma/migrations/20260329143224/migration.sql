/*
  Warnings:

  - You are about to drop the column `agency` on the `animations` table. All the data in the column will be lost.
  - You are about to drop the column `client` on the `animations` table. All the data in the column will be lost.
  - You are about to alter the column `type` on the `block_pages` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(13))`.
  - You are about to alter the column `type` on the `blocks` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(15))`.
  - You are about to alter the column `thumbnail_path` on the `clip_jobs` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to drop the column `agency` on the `photography` table. All the data in the column will be lost.
  - You are about to drop the column `client` on the `photography` table. All the data in the column will be lost.
  - You are about to drop the column `agency` on the `works` table. All the data in the column will be lost.
  - You are about to drop the column `client` on the `works` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[source_media_id,settings_hash]` on the table `clip_jobs` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `presentation_items` DROP FOREIGN KEY `fk_presentation_items_external_thumbnail`;

-- DropIndex
DROP INDEX `blocks_model_id_fkey` ON `blocks`;

-- DropIndex
DROP INDEX `fk_presentation_items_external_thumbnail` ON `presentation_items`;

-- AlterTable
ALTER TABLE `agencies` MODIFY `status` ENUM('DRAFT', 'PUBLISHED', 'UNLISTED') NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE `animations` DROP COLUMN `agency`,
    DROP COLUMN `client`,
    ADD COLUMN `agency_legacy` VARCHAR(191) NULL,
    ADD COLUMN `client_legacy` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `block_pages` MODIFY `type` ENUM('WORKS', 'ANIMATIONS') NOT NULL;

-- AlterTable
ALTER TABLE `blocks` MODIFY `type` ENUM('ONE_COLUMN', 'TWO_COLUMN', 'THREE_COLUMN', 'FOUR_COLUMN', 'ONE_TWO', 'TWO_ONE', 'CUSTOM_COLUMN', 'PARAGRAPH', 'QUOTE', 'MEDIA') NOT NULL;

-- AlterTable
ALTER TABLE `clients` MODIFY `status` ENUM('DRAFT', 'PUBLISHED', 'UNLISTED') NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE `clip_jobs` MODIFY `thumbnail_path` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `media_files` ADD COLUMN `original_deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `photographers` MODIFY `bio` TEXT NULL;

-- AlterTable
ALTER TABLE `photography` DROP COLUMN `agency`,
    DROP COLUMN `client`,
    ADD COLUMN `agency_legacy` VARCHAR(191) NULL,
    ADD COLUMN `client_legacy` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `works` DROP COLUMN `agency`,
    DROP COLUMN `client`,
    ADD COLUMN `agency_legacy` VARCHAR(191) NULL,
    ADD COLUMN `client_legacy` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `clip_jobs_source_media_id_settings_hash_key` ON `clip_jobs`(`source_media_id`, `settings_hash`);

-- AddForeignKey
ALTER TABLE `presentation_items` ADD CONSTRAINT `presentation_items_external_thumbnail_id_fkey` FOREIGN KEY (`external_thumbnail_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
