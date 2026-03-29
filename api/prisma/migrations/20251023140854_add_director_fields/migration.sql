-- AlterTable
ALTER TABLE `directors` ADD COLUMN `created_by` INTEGER NULL,
    ADD COLUMN `published_at` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT';

-- AddForeignKey
ALTER TABLE `directors` ADD CONSTRAINT `directors_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
