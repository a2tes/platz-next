-- Add status, deletedAt, purgedAt, createdBy to clients and agencies tables

-- Clients
ALTER TABLE `clients` ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE `clients` ADD COLUMN `deleted_at` DATETIME(3) NULL;
ALTER TABLE `clients` ADD COLUMN `purged_at` DATETIME(3) NULL;
ALTER TABLE `clients` ADD COLUMN `created_by` INT NULL;

-- Agencies
ALTER TABLE `agencies` ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE `agencies` ADD COLUMN `deleted_at` DATETIME(3) NULL;
ALTER TABLE `agencies` ADD COLUMN `purged_at` DATETIME(3) NULL;
ALTER TABLE `agencies` ADD COLUMN `created_by` INT NULL;

-- Add foreign key constraints for createdBy
ALTER TABLE `clients` ADD CONSTRAINT `clients_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `agencies` ADD CONSTRAINT `agencies_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
