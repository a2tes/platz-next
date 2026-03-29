-- AlterTable
ALTER TABLE `media_files` ADD COLUMN `thumbnail_path` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;
