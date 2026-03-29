-- DropForeignKey: animation_agencies (IF EXISTS - may have been dropped already)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'animation_agencies_animation_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `animation_agencies` DROP FOREIGN KEY `animation_agencies_animation_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'animation_agencies_agency_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `animation_agencies` DROP FOREIGN KEY `animation_agencies_agency_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DropForeignKey: photography_agencies
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'photography_agencies_photography_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `photography_agencies` DROP FOREIGN KEY `photography_agencies_photography_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'photography_agencies_agency_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `photography_agencies` DROP FOREIGN KEY `photography_agencies_agency_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DropForeignKey: work_agencies
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'work_agencies_work_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `work_agencies` DROP FOREIGN KEY `work_agencies_work_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'work_agencies_agency_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `work_agencies` DROP FOREIGN KEY `work_agencies_agency_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DropForeignKey: agencies created_by
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'agencies_created_by_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `agencies` DROP FOREIGN KEY `agencies_created_by_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DropTable: junction tables
DROP TABLE IF EXISTS `work_agencies`;
DROP TABLE IF EXISTS `photography_agencies`;
DROP TABLE IF EXISTS `animation_agencies`;

-- DropTable: agencies
DROP TABLE IF EXISTS `agencies`;

-- AlterTable: drop legacy agency columns (conditional)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'works' AND COLUMN_NAME = 'agency');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE `works` DROP COLUMN `agency`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'photography' AND COLUMN_NAME = 'agency');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE `photography` DROP COLUMN `agency`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'animations' AND COLUMN_NAME = 'agency');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE `animations` DROP COLUMN `agency`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
