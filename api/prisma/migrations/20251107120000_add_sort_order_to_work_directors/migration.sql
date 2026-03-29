-- Add sort_order column to work_directors join table
ALTER TABLE `work_directors` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 AFTER `director_id`;

-- Initialize ordering per director sequentially (optional normalization)
-- This block sets sort_order based on current work_id ordering for each director.
UPDATE `work_directors` wd
JOIN (
  SELECT director_id, work_id,
         ROW_NUMBER() OVER (PARTITION BY director_id ORDER BY work_id) AS rn
  FROM work_directors
) x ON x.director_id = wd.director_id AND x.work_id = wd.work_id
SET wd.sort_order = x.rn;
