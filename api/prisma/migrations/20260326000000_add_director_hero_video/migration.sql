-- AlterTable
ALTER TABLE `directors` ADD COLUMN `hero_media_id` INTEGER NULL,
    ADD COLUMN `hero_video` JSON NULL;

-- AddForeignKey
ALTER TABLE `directors` ADD CONSTRAINT `directors_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `directors_hero_media_id_fkey` ON `directors`(`hero_media_id`);
