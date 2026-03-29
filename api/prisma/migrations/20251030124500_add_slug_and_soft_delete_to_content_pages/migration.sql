-- Add slug, deleted_at, purged_at to content_pages
ALTER TABLE `content_pages`
  ADD COLUMN `slug` VARCHAR(191) NULL,
  ADD COLUMN `deleted_at` DATETIME NULL,
  ADD COLUMN `purged_at` DATETIME NULL;

-- Ensure slugs are unique
CREATE UNIQUE INDEX `content_pages_slug_key` ON `content_pages`(`slug`);
