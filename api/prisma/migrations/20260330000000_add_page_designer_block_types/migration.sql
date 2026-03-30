-- AlterTable: Add new BlockType enum values for the page designer
ALTER TABLE `blocks` MODIFY COLUMN `type` ENUM('ONE_COLUMN', 'TWO_COLUMN', 'THREE_COLUMN', 'FOUR_COLUMN', 'ONE_TWO', 'TWO_ONE', 'CUSTOM_COLUMN', 'PARAGRAPH', 'QUOTE', 'MEDIA', 'HEADING', 'SPACER', 'DIVIDER', 'EMBED', 'CODE_BLOCK') NOT NULL;
