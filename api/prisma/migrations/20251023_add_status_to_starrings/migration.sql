-- Add status, published_at, and created_by to starrings table
ALTER TABLE `starrings` ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE `starrings` ADD COLUMN `published_at` DATETIME(3) NULL;
ALTER TABLE `starrings` ADD COLUMN `created_by` INT NULL;

-- Add foreign key for created_by
ALTER TABLE `starrings` ADD CONSTRAINT `starrings_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for status
CREATE INDEX `starrings_status_idx` ON `starrings`(`status`);
