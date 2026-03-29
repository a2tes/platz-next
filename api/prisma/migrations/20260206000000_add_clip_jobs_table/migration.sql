-- CreateTable
CREATE TABLE `clip_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `source_media_id` INTEGER NOT NULL,
    `context_type` VARCHAR(191) NOT NULL,
    `context_id` INTEGER NOT NULL,
    `slot_index` INTEGER NULL,
    `crop_settings` JSON NULL,
    `trim_settings` JSON NULL,
    `settings_hash` VARCHAR(191) NOT NULL,
    `max_dimension` INTEGER NOT NULL DEFAULT 1280,
    `quality` VARCHAR(191) NOT NULL DEFAULT 'high',
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `media_convert_job_id` VARCHAR(191) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `output_path` VARCHAR(191) NULL,
    `output_url` VARCHAR(191) NULL,
    `output_metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,

    INDEX `clip_jobs_context_type_context_id_idx`(`context_type`, `context_id`),
    INDEX `clip_jobs_source_media_id_idx`(`source_media_id`),
    INDEX `clip_jobs_status_idx`(`status`),
    INDEX `clip_jobs_settings_hash_idx`(`settings_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `clip_jobs` ADD CONSTRAINT `clip_jobs_source_media_id_fkey` FOREIGN KEY (`source_media_id`) REFERENCES `media_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
