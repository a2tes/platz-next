-- DropForeignKey
ALTER TABLE `works` DROP FOREIGN KEY IF EXISTS `works_video_thumbnail_id_fkey`;

-- AlterTable
ALTER TABLE `works` DROP COLUMN IF EXISTS `video_thumbnail_id`;
