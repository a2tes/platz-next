-- Remove director_id FK from presentation_items
ALTER TABLE `presentation_items` DROP FOREIGN KEY IF EXISTS `presentation_items_director_id_fkey`;
ALTER TABLE `presentation_items` DROP COLUMN `director_id`;

-- Drop junction/dependent tables first (respecting FK constraints)
DROP TABLE IF EXISTS `presentation_director_works`;
DROP TABLE IF EXISTS `presentation_directors`;
DROP TABLE IF EXISTS `directors_page_selections`;
DROP TABLE IF EXISTS `homepage_directors`;
DROP TABLE IF EXISTS `work_directors`;

-- Drop main directors table
DROP TABLE IF EXISTS `directors`;

-- Remove DIRECTORS from PresentationSectionType enum
-- MySQL doesn't support ALTER TYPE, so we recreate the column constraint
ALTER TABLE `presentation_sections` MODIFY COLUMN `type` ENUM('ANIMATIONS', 'PHOTOGRAPHY', 'MIXED') NOT NULL;
