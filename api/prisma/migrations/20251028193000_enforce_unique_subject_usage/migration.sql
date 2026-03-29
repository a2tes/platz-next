-- Deduplicate rows so that for each (subject_type, subject_id, usage_key) only the newest remains
DELETE m1 FROM `mediables` m1
JOIN `mediables` m2
  ON m1.`subject_type` = m2.`subject_type`
 AND m1.`subject_id` = m2.`subject_id`
 AND m1.`usage_key` = m2.`usage_key`
 AND m1.`id` < m2.`id`;

-- Drop old unique index that included media_id (if exists)
ALTER TABLE `mediables`
  DROP INDEX `mediables_subject_type_subject_id_usage_key_media_id_key`;

-- Drop non-unique triple index; will replace with UNIQUE
ALTER TABLE `mediables`
  DROP INDEX `mediables_subject_type_subject_id_usage_key_idx`;

-- Create new unique index on (subject_type, subject_id, usage_key)
CREATE UNIQUE INDEX `mediables_subject_type_subject_id_usage_key_key`
  ON `mediables`(`subject_type`, `subject_id`, `usage_key`);
