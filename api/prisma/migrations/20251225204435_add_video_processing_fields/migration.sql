-- AlterTable
ALTER TABLE `media_files` ADD COLUMN `hls_url` VARCHAR(191) NULL,
    ADD COLUMN `optimized_urls` JSON NULL,
    ADD COLUMN `optimized_video_url` VARCHAR(191) NULL,
    ADD COLUMN `processing_completed_at` DATETIME(3) NULL,
    ADD COLUMN `processing_error` TEXT NULL,
    ADD COLUMN `processing_job_id` VARCHAR(191) NULL,
    ADD COLUMN `processing_started_at` DATETIME(3) NULL,
    ADD COLUMN `processing_status` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;
