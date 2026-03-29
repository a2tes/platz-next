-- AlterTable
ALTER TABLE `homepage_directors` ADD COLUMN `video_source` VARCHAR(191) NOT NULL DEFAULT 'original';
ALTER TABLE `homepage_directors` ADD COLUMN `clip_job_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `homepage_directors_clip_job_id_idx` ON `homepage_directors`(`clip_job_id`);

-- AddForeignKey
ALTER TABLE `homepage_directors` ADD CONSTRAINT `homepage_directors_clip_job_id_fkey` FOREIGN KEY (`clip_job_id`) REFERENCES `clip_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
