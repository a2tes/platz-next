-- Add groupByClient field to photographers table
-- This controls the presentation style: true = Client Groups, false = Single Feed
ALTER TABLE `photographers` ADD COLUMN `group_by_client` BOOLEAN NOT NULL DEFAULT true;
