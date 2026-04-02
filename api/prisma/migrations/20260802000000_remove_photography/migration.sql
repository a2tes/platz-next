-- Remove Photography Feature
-- Drops photography tables, photographer tables, and related columns/enum values

-- 1. Delete data that references photography enum values (before modifying enums)
DELETE FROM `presentation_items` WHERE `itemType` = 'PHOTOGRAPHY';
DELETE FROM `presentation_sections` WHERE `type` = 'PHOTOGRAPHY';

-- 2. Drop FK constraint for photography_id in presentation_items
ALTER TABLE `presentation_items` DROP FOREIGN KEY IF EXISTS `presentation_items_photography_id_fkey`;

-- 3. Drop photography_id column from presentation_items
ALTER TABLE `presentation_items` DROP COLUMN IF EXISTS `photography_id`;

-- 4. Drop photography_taxonomies junction table
DROP TABLE IF EXISTS `photography_taxonomies`;

-- 5. Drop photography table
DROP TABLE IF EXISTS `photography`;

-- 6. Drop photographers table
DROP TABLE IF EXISTS `photographers`;

-- 7. Remove PHOTOGRAPHY from PresentationSectionType enum
ALTER TABLE `presentation_sections` MODIFY COLUMN `type` ENUM('MIXED') NOT NULL;

-- 8. Remove PHOTOGRAPHY from PresentationItemType enum
ALTER TABLE `presentation_items` MODIFY COLUMN `itemType` ENUM('WORK', 'EXTERNAL_LINK') NOT NULL;

-- 9. Remove PHOTO_CATEGORY from TaxonomyType enum
-- First delete any taxonomies with PHOTO_CATEGORY type
DELETE FROM `taxonomies` WHERE `type` = 'PHOTO_CATEGORY';
ALTER TABLE `taxonomies` MODIFY COLUMN `type` ENUM('CLIENT', 'SECTOR', 'DISCIPLINE') NOT NULL;
