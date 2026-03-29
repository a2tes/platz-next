-- CreateTable
CREATE TABLE `directors_page_selections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `director_id` INTEGER NOT NULL,
    `work_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `video_source` VARCHAR(191) NOT NULL DEFAULT 'original',
    `clip_job_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `directors_page_selections_director_id_key`(`director_id`),
    INDEX `directors_page_selections_clip_job_id_idx`(`clip_job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `directors_page_selections` ADD CONSTRAINT `directors_page_selections_director_id_fkey` FOREIGN KEY (`director_id`) REFERENCES `directors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `directors_page_selections` ADD CONSTRAINT `directors_page_selections_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `directors_page_selections` ADD CONSTRAINT `directors_page_selections_clip_job_id_fkey` FOREIGN KEY (`clip_job_id`) REFERENCES `clip_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
