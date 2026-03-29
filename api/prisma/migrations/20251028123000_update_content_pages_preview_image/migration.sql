-- Replace og/twitter images with preview_image on content_pages

-- 1) Add preview_image_id column first (so we can backfill)
ALTER TABLE `content_pages`
  ADD COLUMN `preview_image_id` INT NULL AFTER `meta_keywords`;

-- 2) Backfill from existing columns (prefer og_image_id, else twitter_image_id)
UPDATE `content_pages`
SET `preview_image_id` = COALESCE(`og_image_id`, `twitter_image_id`)
WHERE `preview_image_id` IS NULL;

-- 3) Add foreign key constraint to media_files(id)
ALTER TABLE `content_pages`
  ADD CONSTRAINT `content_pages_preview_image_id_fkey`
  FOREIGN KEY (`preview_image_id`) REFERENCES `media_files`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 4) Drop foreign keys referencing old columns
ALTER TABLE `content_pages` DROP FOREIGN KEY `content_pages_og_image_id_fkey`;
ALTER TABLE `content_pages` DROP FOREIGN KEY `content_pages_twitter_image_id_fkey`;

-- 5) Drop old columns (indexes on these columns will be dropped implicitly)
ALTER TABLE `content_pages`
  DROP COLUMN `og_image_id`,
  DROP COLUMN `twitter_image_id`;
