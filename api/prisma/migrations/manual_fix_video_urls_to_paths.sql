-- Remove CloudFront domain from video-related fields, keeping only the path
-- This is a manual migration to fix existing records

-- Update hlsUrl: https://di8jtbc1rw6ys.cloudfront.net/optimized/... -> optimized/...
UPDATE media_files 
SET hls_url = REGEXP_REPLACE(hls_url, '^https://[^/]+/', '')
WHERE hls_url IS NOT NULL AND hls_url LIKE 'https://%';

-- Update optimizedVideoUrl
UPDATE media_files 
SET optimized_video_url = REGEXP_REPLACE(optimized_video_url, '^https://[^/]+/', '')
WHERE optimized_video_url IS NOT NULL AND optimized_video_url LIKE 'https://%';

-- Update optimizedUrls JSON - this is trickier, we need to update each key in the JSON
-- For MySQL 8.0+, we can use JSON_SET with string replacement
UPDATE media_files 
SET optimized_urls = JSON_SET(
    optimized_urls,
    '$."1080p"', REGEXP_REPLACE(JSON_UNQUOTE(JSON_EXTRACT(optimized_urls, '$."1080p"')), '^https://[^/]+/', ''),
    '$."720p"', REGEXP_REPLACE(JSON_UNQUOTE(JSON_EXTRACT(optimized_urls, '$."720p"')), '^https://[^/]+/', ''),
    '$."480p"', REGEXP_REPLACE(JSON_UNQUOTE(JSON_EXTRACT(optimized_urls, '$."480p"')), '^https://[^/]+/', '')
)
WHERE optimized_urls IS NOT NULL 
AND JSON_EXTRACT(optimized_urls, '$."1080p"') IS NOT NULL;

