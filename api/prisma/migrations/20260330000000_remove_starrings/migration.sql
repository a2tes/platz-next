-- DropForeignKey: work_starrings
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'work_starrings_work_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `work_starrings` DROP FOREIGN KEY `work_starrings_work_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'work_starrings_starring_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `work_starrings` DROP FOREIGN KEY `work_starrings_starring_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DropForeignKey: photography_starrings
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'photography_starrings_photography_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `photography_starrings` DROP FOREIGN KEY `photography_starrings_photography_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'photography_starrings_starring_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `photography_starrings` DROP FOREIGN KEY `photography_starrings_starring_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DropForeignKey: starrings
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'starrings_avatar_id_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `starrings` DROP FOREIGN KEY `starrings_avatar_id_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'starrings_created_by_fkey' AND TABLE_SCHEMA = DATABASE());
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `starrings` DROP FOREIGN KEY `starrings_created_by_fkey`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- DropTable: junction tables
DROP TABLE IF EXISTS `work_starrings`;
DROP TABLE IF EXISTS `photography_starrings`;

-- DropTable: starrings
DROP TABLE IF EXISTS `starrings`;
