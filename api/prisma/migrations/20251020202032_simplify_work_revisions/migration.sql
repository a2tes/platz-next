/*
  Warnings:

  - You are about to drop the column `changes` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `client` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `meta_description` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `meta_keywords` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `og_image_id` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `short_description` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `twitter_image_id` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `video_file_id` on the `work_revisions` table. All the data in the column will be lost.
  - You are about to drop the column `video_thumbnail_id` on the `work_revisions` table. All the data in the column will be lost.
  - Added the required column `payload` to the `work_revisions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `work_revisions` DROP COLUMN `changes`,
    DROP COLUMN `client`,
    DROP COLUMN `meta_description`,
    DROP COLUMN `meta_keywords`,
    DROP COLUMN `og_image_id`,
    DROP COLUMN `short_description`,
    DROP COLUMN `status`,
    DROP COLUMN `tags`,
    DROP COLUMN `title`,
    DROP COLUMN `twitter_image_id`,
    DROP COLUMN `updated_at`,
    DROP COLUMN `video_file_id`,
    DROP COLUMN `video_thumbnail_id`,
    ADD COLUMN `payload` JSON NOT NULL;
