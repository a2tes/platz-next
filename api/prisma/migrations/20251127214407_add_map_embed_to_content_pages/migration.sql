-- AlterTable
ALTER TABLE `content_pages` ADD COLUMN `map_embed` TEXT NULL;

-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;
