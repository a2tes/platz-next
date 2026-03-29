-- Convert mediables crop fields to pixel-based ints and/or create table if missing

-- 1) Create table if not exists (MariaDB/MySQL)
CREATE TABLE IF NOT EXISTS `mediables` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `media_id` INT NOT NULL,
  `subject_type` VARCHAR(191) NOT NULL,
  `subject_id` INT NOT NULL,
  `usage_key` VARCHAR(191) NOT NULL,
  `crop_type` ENUM('freeform','square','default','wide') NOT NULL,
  `crop_x` INT NOT NULL DEFAULT 0,
  `crop_y` INT NOT NULL DEFAULT 0,
  `crop_w` INT NOT NULL DEFAULT 1,
  `crop_h` INT NOT NULL DEFAULT 1,
  `original_w` INT NOT NULL DEFAULT 0,
  `original_h` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `mediables_subject_unique` (`subject_type`,`subject_id`,`usage_key`,`media_id`),
  KEY `mediables_media_idx` (`media_id`),
  KEY `mediables_subject_usage_idx` (`subject_type`,`subject_id`,`usage_key`),
  PRIMARY KEY (`id`),
  CONSTRAINT `mediables_media_fk` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) If table exists with normalized columns x,y,w,h, migrate them to crop_x..crop_h
-- Add new columns if they don't exist
ALTER TABLE `mediables`
  ADD COLUMN IF NOT EXISTS `crop_x` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `crop_y` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `crop_w` INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `crop_h` INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `original_w` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `original_h` INT NOT NULL DEFAULT 0;

-- If old normalized columns exist and original dimensions are available, convert to px
-- Note: information_schema checks to avoid errors in differing schemas
SET @has_x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mediables' AND COLUMN_NAME = 'x');
SET @has_y := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mediables' AND COLUMN_NAME = 'y');
SET @has_w := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mediables' AND COLUMN_NAME = 'w');
SET @has_h := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mediables' AND COLUMN_NAME = 'h');

SET @sql := IF(@has_x > 0 AND @has_y > 0 AND @has_w > 0 AND @has_h > 0,
  'UPDATE `mediables` SET \n    crop_x = ROUND(x * NULLIF(original_w,0)),\n    crop_y = ROUND(y * NULLIF(original_h,0)),\n    crop_w = GREATEST(1, ROUND(w * NULLIF(original_w,0))),\n    crop_h = GREATEST(1, ROUND(h * NULLIF(original_h,0)))\n  WHERE original_w > 0 AND original_h > 0',
  'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Drop old columns if they exist
SET @drop_cols_sql := (
  SELECT COALESCE(
    CONCAT('ALTER TABLE `mediables` ', GROUP_CONCAT(cmd SEPARATOR ', ')),
    'SELECT 1'
  )
  FROM (
    SELECT 'DROP COLUMN `x`' AS cmd FROM DUAL WHERE @has_x > 0
    UNION ALL
    SELECT 'DROP COLUMN `y`' FROM DUAL WHERE @has_y > 0
    UNION ALL
    SELECT 'DROP COLUMN `w`' FROM DUAL WHERE @has_w > 0
    UNION ALL
    SELECT 'DROP COLUMN `h`' FROM DUAL WHERE @has_h > 0
  ) t
);

PREPARE stmt2 FROM @drop_cols_sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
