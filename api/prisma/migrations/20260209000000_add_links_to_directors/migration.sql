-- Add links JSON column to directors table
ALTER TABLE `directors` ADD COLUMN `links` JSON NULL AFTER `biography`;
