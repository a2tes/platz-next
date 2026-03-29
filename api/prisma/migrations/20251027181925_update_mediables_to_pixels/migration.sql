-- DropForeignKey
ALTER TABLE `mediables` DROP FOREIGN KEY `mediables_media_fk`;

-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `crop_x` DROP DEFAULT,
    ALTER COLUMN `crop_y` DROP DEFAULT,
    ALTER COLUMN `crop_w` DROP DEFAULT,
    ALTER COLUMN `crop_h` DROP DEFAULT,
    ALTER COLUMN `original_w` DROP DEFAULT,
    ALTER COLUMN `original_h` DROP DEFAULT,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `mediables` ADD CONSTRAINT `mediables_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `mediables_media_id_idx` ON `mediables`(`media_id`);
DROP INDEX `mediables_media_idx` ON `mediables`;

-- RedefineIndex
CREATE UNIQUE INDEX `mediables_subject_type_subject_id_usage_key_media_id_key` ON `mediables`(`subject_type`, `subject_id`, `usage_key`, `media_id`);
DROP INDEX `mediables_subject_unique` ON `mediables`;

-- RedefineIndex
CREATE INDEX `mediables_subject_type_subject_id_usage_key_idx` ON `mediables`(`subject_type`, `subject_id`, `usage_key`);
DROP INDEX `mediables_subject_usage_idx` ON `mediables`;
