/*
  Warnings:

  - You are about to drop the column `crop_type` on the `mediables` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `mediables` DROP COLUMN `crop_type`,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `works` ADD COLUMN `agency` VARCHAR(191) NULL;
