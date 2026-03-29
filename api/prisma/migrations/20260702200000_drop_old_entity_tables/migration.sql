-- Drop old junction tables first (they have foreign keys to entity tables)
DROP TABLE IF EXISTS `work_clients`;
DROP TABLE IF EXISTS `work_disciplines`;
DROP TABLE IF EXISTS `work_sectors`;
DROP TABLE IF EXISTS `photography_clients`;
DROP TABLE IF EXISTS `photography_categories`;
DROP TABLE IF EXISTS `animation_clients`;

-- Drop old entity tables
DROP TABLE IF EXISTS `clients`;
DROP TABLE IF EXISTS `disciplines`;
DROP TABLE IF EXISTS `sectors`;
DROP TABLE IF EXISTS `photo_categories`;
