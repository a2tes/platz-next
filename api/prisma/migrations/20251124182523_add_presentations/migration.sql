-- AlterTable
ALTER TABLE `mediables` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `presentations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `valid_until` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `presentations_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `presentation_directors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `presentation_id` INTEGER NOT NULL,
    `director_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `presentation_directors_presentation_id_director_id_key`(`presentation_id`, `director_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `presentation_director_works` (
    `presentation_director_id` INTEGER NOT NULL,
    `work_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`presentation_director_id`, `work_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `presentation_directors` ADD CONSTRAINT `presentation_directors_presentation_id_fkey` FOREIGN KEY (`presentation_id`) REFERENCES `presentations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presentation_directors` ADD CONSTRAINT `presentation_directors_director_id_fkey` FOREIGN KEY (`director_id`) REFERENCES `directors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presentation_director_works` ADD CONSTRAINT `presentation_director_works_presentation_director_id_fkey` FOREIGN KEY (`presentation_director_id`) REFERENCES `presentation_directors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presentation_director_works` ADD CONSTRAINT `presentation_director_works_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
