/*
  Warnings:

  - You are about to alter the column `status` on the `starrings` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(9))`.
  - Made the column `slug` on table `content_pages` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `content_pages` MODIFY `slug` VARCHAR(191) NOT NULL,
    MODIFY `deleted_at` DATETIME(3) NULL,
    MODIFY `purged_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `photography` MODIFY `slug` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `starrings` MODIFY `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT';
