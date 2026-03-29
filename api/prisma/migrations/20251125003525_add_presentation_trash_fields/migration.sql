-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `presentations` ADD COLUMN `created_by` INTEGER NULL,
    ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `published_at` DATETIME(3) NULL,
    ADD COLUMN `purged_at` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `presentations` ADD CONSTRAINT `presentations_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
