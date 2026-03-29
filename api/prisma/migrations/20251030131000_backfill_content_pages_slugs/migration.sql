-- Backfill slugs for existing content_pages rows with NULL slug
-- Ensure unique and non-null slugs, based on title + id
UPDATE `content_pages`
SET `slug` = LOWER(REPLACE(TRIM(IFNULL(`title`, 'page')), ' ', '-'))
WHERE `slug` IS NULL;

-- For any duplicates that might violate uniqueness, append id suffix safely
-- MySQL won't allow creating duplicates due to unique index; as a safe fallback ensure uniqueness via id suffix
UPDATE `content_pages` cp
LEFT JOIN (
  SELECT `slug`, COUNT(*) as c
  FROM `content_pages`
  WHERE `slug` IS NOT NULL
  GROUP BY `slug`
  HAVING c > 1
) dups ON cp.`slug` = dups.`slug`
SET cp.`slug` = CONCAT(cp.`slug`, '-', cp.`id`)
WHERE dups.`slug` IS NOT NULL;
