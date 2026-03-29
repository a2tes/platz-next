-- Add new columns
ALTER TABLE media_files ADD COLUMN uuid VARCHAR(255) NULL;
ALTER TABLE media_files ADD COLUMN alt_text VARCHAR(1000) NULL;

-- Generate UUIDs for existing records based on their filenames
-- Format: random-uuid/lowercase-filename
UPDATE media_files 
SET uuid = CONCAT(
  UUID(),
  '/',
  LOWER(filename)
) 
WHERE uuid IS NULL;

-- Make uuid NOT NULL and UNIQUE
ALTER TABLE media_files MODIFY COLUMN uuid VARCHAR(255) NOT NULL UNIQUE;

-- Drop old columns
ALTER TABLE media_files DROP COLUMN imgix_url;
ALTER TABLE media_files DROP COLUMN s3_key;
ALTER TABLE media_files DROP COLUMN path;
