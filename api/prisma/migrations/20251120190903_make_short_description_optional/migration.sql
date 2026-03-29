-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `photography` MODIFY `description` TEXT NULL,
    MODIFY `client` VARCHAR(191) NULL,
    MODIFY `year` INTEGER NULL,
    MODIFY `location` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE `works` MODIFY `short_description` TEXT NULL;
