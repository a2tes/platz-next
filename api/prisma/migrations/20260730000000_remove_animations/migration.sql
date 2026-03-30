-- Remove Animations Feature
-- Drops animation tables and related columns/enum values

-- 1. Delete data that references animation enum values (before modifying enums)
DELETE FROM `presentation_items` WHERE `itemType` = 'ANIMATION';
DELETE FROM `presentation_sections` WHERE `type` = 'ANIMATIONS';
DELETE FROM `block_pages` WHERE `type` = 'ANIMATIONS';

-- 2. Drop FK constraint for animation_id in presentation_items
ALTER TABLE `presentation_items` DROP FOREIGN KEY IF EXISTS `presentation_items_animation_id_fkey`;

-- 3. Drop animation_id column from presentation_items
ALTER TABLE `presentation_items` DROP COLUMN IF EXISTS `animation_id`;

-- 4. Drop animation_taxonomies junction table
DROP TABLE IF EXISTS `animation_taxonomies`;

-- 5. Drop animation_revisions table
DROP TABLE IF EXISTS `animation_revisions`;

-- 6. Drop animations table
DROP TABLE IF EXISTS `animations`;

-- 7. Remove ANIMATIONS from BlockPageType enum
ALTER TABLE `block_pages` MODIFY COLUMN `type` ENUM('WORKS') NOT NULL;

-- 8. Remove ANIMATIONS from PresentationSectionType enum
ALTER TABLE `presentation_sections` MODIFY COLUMN `type` ENUM('PHOTOGRAPHY', 'MIXED') NOT NULL;

-- 9. Remove ANIMATION from PresentationItemType enum
ALTER TABLE `presentation_items` MODIFY COLUMN `itemType` ENUM('WORK', 'PHOTOGRAPHY', 'EXTERNAL_LINK') NOT NULL;
