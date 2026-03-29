/*
  Warnings:

  - You are about to alter the column `uuid` on the `media_files` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `alt_text` on the `media_files` table. The data in that column could be lost. The data in that column will be cast from `VarChar(1000)` to `VarChar(191)`.

*/
-- DropIndex
DROP INDEX `starrings_status_idx` ON `starrings`;

-- AlterTable
ALTER TABLE `media_files` MODIFY `uuid` VARCHAR(191) NOT NULL,
    MODIFY `alt_text` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `photo_categories` ADD COLUMN `created_by` INTEGER NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `photographers` ADD COLUMN `created_by` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `photographers` ADD CONSTRAINT `photographers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photo_categories` ADD CONSTRAINT `photo_categories_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
CREATE UNIQUE INDEX `media_files_uuid_key` ON `media_files`(`uuid`);
DROP INDEX `uuid` ON `media_files`;
