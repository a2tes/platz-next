-- Add created_by column and foreign key to content_pages
ALTER TABLE `content_pages`
  ADD COLUMN `created_by` INT NULL;

ALTER TABLE `content_pages`
  ADD CONSTRAINT `content_pages_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
