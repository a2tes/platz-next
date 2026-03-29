-- AlterTable
ALTER TABLE `directors` ADD COLUMN `hero_work_id` INT NULL;

-- AddForeignKey
ALTER TABLE `directors` ADD CONSTRAINT `directors_hero_work_id_fkey` FOREIGN KEY (`hero_work_id`) REFERENCES `works`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
