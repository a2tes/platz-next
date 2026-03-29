-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `works` ADD COLUMN `case_study` TEXT NULL,
    ADD COLUMN `subtitle` VARCHAR(255) NULL;
