-- Add new fields to clip_jobs table for improved clip management

-- Add work_id for slot verification
ALTER TABLE `clip_jobs` ADD COLUMN `work_id` INT NULL AFTER `source_media_id`;

-- Make context fields nullable (for standalone media library clips)
ALTER TABLE `clip_jobs` MODIFY COLUMN `context_type` VARCHAR(191) NULL;
ALTER TABLE `clip_jobs` MODIFY COLUMN `context_id` INT NULL;

-- Add is_default flag
ALTER TABLE `clip_jobs` ADD COLUMN `is_default` BOOLEAN NOT NULL DEFAULT FALSE AFTER `settings_hash`;

-- Add foreign key for work_id
ALTER TABLE `clip_jobs` ADD CONSTRAINT `clip_jobs_work_id_fkey` 
FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unique constraint for deduplication (same video + settings = same clip)
-- First, handle any existing duplicates by keeping the latest one
-- This is a safety measure - you may need to run this separately if there are duplicates

-- Create index for work_id
CREATE INDEX `clip_jobs_work_id_idx` ON `clip_jobs`(`work_id`);

-- Create composite index for default clips lookup
CREATE INDEX `clip_jobs_source_media_id_is_default_idx` ON `clip_jobs`(`source_media_id`, `is_default`);

-- Add unique constraint - will fail if duplicates exist
-- ALTER TABLE `clip_jobs` ADD CONSTRAINT `clip_jobs_source_media_id_settings_hash_key` 
-- UNIQUE (`source_media_id`, `settings_hash`);
-- Note: Uncomment above after verifying no duplicates exist, or clean them first
