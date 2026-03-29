-- AlterTable: Add new fields to presentations
ALTER TABLE `presentations` ADD COLUMN `client_name` VARCHAR(191) NULL;
ALTER TABLE `presentations` ADD COLUMN `client_note` TEXT NULL;
ALTER TABLE `presentations` ADD COLUMN `auto_play_enabled` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `presentations` ADD COLUMN `photo_slide_duration` INTEGER NOT NULL DEFAULT 5;

-- CreateTable: presentation_sections
CREATE TABLE `presentation_sections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `presentation_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('DIRECTORS', 'ANIMATIONS', 'PHOTOGRAPHY', 'MIXED') NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: presentation_items
CREATE TABLE `presentation_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_id` INTEGER NOT NULL,
    `itemType` ENUM('WORK', 'ANIMATION', 'PHOTOGRAPHY') NOT NULL,
    `work_id` INTEGER NULL,
    `animation_id` INTEGER NULL,
    `photography_id` INTEGER NULL,
    `director_id` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `presentation_sections` ADD CONSTRAINT `presentation_sections_presentation_id_fkey` FOREIGN KEY (`presentation_id`) REFERENCES `presentations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presentation_items` ADD CONSTRAINT `presentation_items_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `presentation_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presentation_items` ADD CONSTRAINT `presentation_items_work_id_fkey` FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presentation_items` ADD CONSTRAINT `presentation_items_animation_id_fkey` FOREIGN KEY (`animation_id`) REFERENCES `animations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presentation_items` ADD CONSTRAINT `presentation_items_photography_id_fkey` FOREIGN KEY (`photography_id`) REFERENCES `photography`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presentation_items` ADD CONSTRAINT `presentation_items_director_id_fkey` FOREIGN KEY (`director_id`) REFERENCES `directors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
