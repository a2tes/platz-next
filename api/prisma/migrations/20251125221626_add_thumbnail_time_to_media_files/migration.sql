-- AlterTable
ALTER TABLE `media_files` ADD COLUMN `thumbnail_time` DOUBLE NULL;

-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;
