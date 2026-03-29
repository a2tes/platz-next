-- Add missing 'path' column to media_files for local storage path
ALTER TABLE `media_files` ADD COLUMN `path` VARCHAR(191) NULL;

-- Add soft delete columns across entities per Prisma schema
ALTER TABLE `users`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;

ALTER TABLE `media_files`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;

ALTER TABLE `media_folders`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;

ALTER TABLE `works`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;

ALTER TABLE `directors`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;

ALTER TABLE `starrings`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;

ALTER TABLE `photography`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;

ALTER TABLE `photographers`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;

ALTER TABLE `photo_categories`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `purged_at` DATETIME(3) NULL;
