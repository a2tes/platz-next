/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `directors` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `photographers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `photography` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `starrings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `works` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `directors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `photographers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `photography` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `starrings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `works` table without a default value. This is not possible if the table is not empty.

*/
-- Step 1: Add slug columns as nullable
ALTER TABLE `directors` ADD COLUMN `slug` VARCHAR(191) NULL;
ALTER TABLE `photographers` ADD COLUMN `slug` VARCHAR(191) NULL;
ALTER TABLE `photography` ADD COLUMN `slug` VARCHAR(191) NULL;
ALTER TABLE `starrings` ADD COLUMN `slug` VARCHAR(191) NULL;
ALTER TABLE `works` ADD COLUMN `slug` VARCHAR(191) NULL;

-- Step 2: Generate slugs from titles
UPDATE `directors` SET `slug` = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`title`, ' ', '-'), 'ç', 'c'), 'ğ', 'g'), 'ı', 'i'), 'ö', 'o'), 'ş', 's'), 'ü', 'u'), 'Ç', 'c'), 'Ğ', 'g'), 'İ', 'i'));
UPDATE `photographers` SET `slug` = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`title`, ' ', '-'), 'ç', 'c'), 'ğ', 'g'), 'ı', 'i'), 'ö', 'o'), 'ş', 's'), 'ü', 'u'), 'Ç', 'c'), 'Ğ', 'g'), 'İ', 'i'));
UPDATE `photography` SET `slug` = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`title`, ' ', '-'), 'ç', 'c'), 'ğ', 'g'), 'ı', 'i'), 'ö', 'o'), 'ş', 's'), 'ü', 'u'), 'Ç', 'c'), 'Ğ', 'g'), 'İ', 'i'));
UPDATE `starrings` SET `slug` = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`title`, ' ', '-'), 'ç', 'c'), 'ğ', 'g'), 'ı', 'i'), 'ö', 'o'), 'ş', 's'), 'ü', 'u'), 'Ç', 'c'), 'Ğ', 'g'), 'İ', 'i'));
UPDATE `works` SET `slug` = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`title`, ' ', '-'), 'ç', 'c'), 'ğ', 'g'), 'ı', 'i'), 'ö', 'o'), 'ş', 's'), 'ü', 'u'), 'Ç', 'c'), 'Ğ', 'g'), 'İ', 'i'));

-- Step 3: Handle potential duplicates by adding id suffix
UPDATE `directors` d1
JOIN (
    SELECT slug, MIN(id) as min_id
    FROM `directors`
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
) d2 ON d1.slug = d2.slug AND d1.id != d2.min_id
SET d1.slug = CONCAT(d1.slug, '-', d1.id);

UPDATE `photographers` p1
JOIN (
    SELECT slug, MIN(id) as min_id
    FROM `photographers`
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
) p2 ON p1.slug = p2.slug AND p1.id != p2.min_id
SET p1.slug = CONCAT(p1.slug, '-', p1.id);

UPDATE `photography` ph1
JOIN (
    SELECT slug, MIN(id) as min_id
    FROM `photography`
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
) ph2 ON ph1.slug = ph2.slug AND ph1.id != ph2.min_id
SET ph1.slug = CONCAT(ph1.slug, '-', ph1.id);

UPDATE `starrings` s1
JOIN (
    SELECT slug, MIN(id) as min_id
    FROM `starrings`
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
) s2 ON s1.slug = s2.slug AND s1.id != s2.min_id
SET s1.slug = CONCAT(s1.slug, '-', s1.id);

UPDATE `works` w1
JOIN (
    SELECT slug, MIN(id) as min_id
    FROM `works`
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
) w2 ON w1.slug = w2.slug AND w1.id != w2.min_id
SET w1.slug = CONCAT(w1.slug, '-', w1.id);

-- Step 4: Make columns NOT NULL
ALTER TABLE `directors` MODIFY COLUMN `slug` VARCHAR(191) NOT NULL;
ALTER TABLE `photographers` MODIFY COLUMN `slug` VARCHAR(191) NOT NULL;
ALTER TABLE `photography` MODIFY COLUMN `slug` VARCHAR(191) NOT NULL;
ALTER TABLE `starrings` MODIFY COLUMN `slug` VARCHAR(191) NOT NULL;
ALTER TABLE `works` MODIFY COLUMN `slug` VARCHAR(191) NOT NULL;

-- Step 5: Create unique indexes
CREATE UNIQUE INDEX `directors_slug_key` ON `directors`(`slug`);
CREATE UNIQUE INDEX `photographers_slug_key` ON `photographers`(`slug`);
CREATE UNIQUE INDEX `photography_slug_key` ON `photography`(`slug`);
CREATE UNIQUE INDEX `starrings_slug_key` ON `starrings`(`slug`);
CREATE UNIQUE INDEX `works_slug_key` ON `works`(`slug`);

