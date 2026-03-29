-- Replace OG/Twitter image columns with a single preview_image_id across works, photography, and photographers

-- Works table: drop old FKs and columns, add preview_image_id
ALTER TABLE `works`
	DROP FOREIGN KEY `works_og_image_id_fkey`,
	DROP FOREIGN KEY `works_twitter_image_id_fkey`;

ALTER TABLE `works`
	DROP COLUMN `og_image_id`,
	DROP COLUMN `twitter_image_id`,
	ADD COLUMN `preview_image_id` INTEGER NULL;

ALTER TABLE `works`
	ADD CONSTRAINT `works_preview_image_id_fkey` FOREIGN KEY (`preview_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Photographers table: drop old FKs and columns, add preview_image_id
ALTER TABLE `photographers`
	DROP FOREIGN KEY `photographers_og_image_id_fkey`,
	DROP FOREIGN KEY `photographers_twitter_image_id_fkey`;

ALTER TABLE `photographers`
	DROP COLUMN `og_image_id`,
	DROP COLUMN `twitter_image_id`,
	ADD COLUMN `preview_image_id` INTEGER NULL;

ALTER TABLE `photographers`
	ADD CONSTRAINT `photographers_preview_image_id_fkey` FOREIGN KEY (`preview_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Photography table: drop old FK and column, add preview_image_id
ALTER TABLE `photography`
	DROP FOREIGN KEY `photography_og_image_id_fkey`;

ALTER TABLE `photography`
	DROP COLUMN `og_image_id`,
	ADD COLUMN `preview_image_id` INTEGER NULL;

ALTER TABLE `photography`
	ADD CONSTRAINT `photography_preview_image_id_fkey` FOREIGN KEY (`preview_image_id`) REFERENCES `media_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
