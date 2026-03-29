-- AlterTable: Add metadata JSON field to media_files
ALTER TABLE `media_files` ADD COLUMN `metadata` JSON NULL;
