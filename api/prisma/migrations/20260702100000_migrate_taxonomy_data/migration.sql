-- Data Migration: Copy existing entities into unified taxonomy system
-- This migration copies data from clients, sectors, disciplines, and photo_categories
-- into the new taxonomies table, and maps their junction table entries to the new
-- work_taxonomies, photography_taxonomies, and animation_taxonomies tables.

-- Step 1: Copy clients → taxonomies (type = 'CLIENT')
INSERT INTO `taxonomies` (`type`, `name`, `slug`, `status`, `sort_order`, `meta_description`, `meta_keywords`, `created_by`, `created_at`, `updated_at`, `deleted_at`, `purged_at`, `metadata`)
SELECT 'CLIENT', `name`, `slug`, `status`, 0, NULL, NULL, `created_by`, `created_at`, `updated_at`, `deleted_at`, `purged_at`, JSON_OBJECT('legacy_id', `id`, 'legacy_table', 'clients')
FROM `clients`;

-- Step 2: Copy sectors → taxonomies (type = 'SECTOR')
INSERT INTO `taxonomies` (`type`, `name`, `slug`, `status`, `sort_order`, `meta_description`, `meta_keywords`, `created_by`, `created_at`, `updated_at`, `deleted_at`, `purged_at`, `metadata`)
SELECT 'SECTOR', `name`, `slug`, `status`, 0, NULL, NULL, `created_by`, `created_at`, `updated_at`, `deleted_at`, `purged_at`, JSON_OBJECT('legacy_id', `id`, 'legacy_table', 'sectors')
FROM `sectors`;

-- Step 3: Copy disciplines → taxonomies (type = 'DISCIPLINE')
INSERT INTO `taxonomies` (`type`, `name`, `slug`, `status`, `sort_order`, `meta_description`, `meta_keywords`, `created_by`, `created_at`, `updated_at`, `deleted_at`, `purged_at`, `metadata`)
SELECT 'DISCIPLINE', `name`, `slug`, `status`, 0, NULL, NULL, `created_by`, `created_at`, `updated_at`, `deleted_at`, `purged_at`, JSON_OBJECT('legacy_id', `id`, 'legacy_table', 'disciplines')
FROM `disciplines`;

-- Step 4: Copy photo_categories → taxonomies (type = 'PHOTO_CATEGORY')
INSERT INTO `taxonomies` (`type`, `name`, `slug`, `status`, `sort_order`, `meta_description`, `meta_keywords`, `og_image_id`, `created_by`, `created_at`, `updated_at`, `deleted_at`, `purged_at`, `metadata`)
SELECT 'PHOTO_CATEGORY', `title`, `slug`, `status`, `sort_order`, `meta_description`, `meta_keywords`, `og_image_id`, `created_by`, `created_at`, `updated_at`, `deleted_at`, `purged_at`, JSON_OBJECT('legacy_id', `id`, 'legacy_table', 'photo_categories')
FROM `photo_categories`;

-- Step 5: Copy work_clients → work_taxonomies
INSERT INTO `work_taxonomies` (`work_id`, `taxonomy_id`)
SELECT wc.`work_id`, t.`id`
FROM `work_clients` wc
INNER JOIN `taxonomies` t ON t.`type` = 'CLIENT' AND t.`slug` = (SELECT c.`slug` FROM `clients` c WHERE c.`id` = wc.`client_id`);

-- Step 6: Copy work_disciplines → work_taxonomies
INSERT INTO `work_taxonomies` (`work_id`, `taxonomy_id`)
SELECT wd.`work_id`, t.`id`
FROM `work_disciplines` wd
INNER JOIN `taxonomies` t ON t.`type` = 'DISCIPLINE' AND t.`slug` = (SELECT d.`slug` FROM `disciplines` d WHERE d.`id` = wd.`discipline_id`);

-- Step 7: Copy work_sectors → work_taxonomies
INSERT INTO `work_taxonomies` (`work_id`, `taxonomy_id`)
SELECT ws.`work_id`, t.`id`
FROM `work_sectors` ws
INNER JOIN `taxonomies` t ON t.`type` = 'SECTOR' AND t.`slug` = (SELECT s.`slug` FROM `sectors` s WHERE s.`id` = ws.`sector_id`);

-- Step 8: Copy photography_clients → photography_taxonomies
INSERT INTO `photography_taxonomies` (`photography_id`, `taxonomy_id`)
SELECT pc.`photography_id`, t.`id`
FROM `photography_clients` pc
INNER JOIN `taxonomies` t ON t.`type` = 'CLIENT' AND t.`slug` = (SELECT c.`slug` FROM `clients` c WHERE c.`id` = pc.`client_id`);

-- Step 9: Copy photography_categories → photography_taxonomies
INSERT INTO `photography_taxonomies` (`photography_id`, `taxonomy_id`)
SELECT pcat.`photography_id`, t.`id`
FROM `photography_categories` pcat
INNER JOIN `taxonomies` t ON t.`type` = 'PHOTO_CATEGORY' AND t.`slug` = (SELECT pc.`slug` FROM `photo_categories` pc WHERE pc.`id` = pcat.`category_id`);

-- Step 10: Copy animation_clients → animation_taxonomies
INSERT INTO `animation_taxonomies` (`animation_id`, `taxonomy_id`)
SELECT ac.`animation_id`, t.`id`
FROM `animation_clients` ac
INNER JOIN `taxonomies` t ON t.`type` = 'CLIENT' AND t.`slug` = (SELECT c.`slug` FROM `clients` c WHERE c.`id` = ac.`client_id`);
