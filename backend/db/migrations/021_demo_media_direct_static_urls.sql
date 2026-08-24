BEGIN;

-- Built-in demo photos are static files shipped by the frontend.
-- Make the URL itself the complete source of truth for demo media.
-- Examples: /media/sump-pump-problem/B-3.png
-- No Cloudinary key or generated origin is needed for these rows.

UPDATE media
SET
  url = CASE
    WHEN url LIKE '%/sample-projects/%' THEN
      '/media/' || split_part(url, '/sample-projects/', 2)
    WHEN url LIKE '%/media/%' THEN
      '/media/' || split_part(url, '/media/', 2)
    WHEN storage_key LIKE 'sample-projects/%' THEN
      '/media/' || substring(storage_key FROM length('sample-projects/') + 1)
    WHEN storage_key LIKE 'media/%' THEN
      '/' || storage_key
    WHEN storage_key LIKE '%/seed/%' THEN
      '/media/' || regexp_replace(
        split_part(storage_key, '/seed/', 2),
        '[^/]+$',
        COALESCE(original_filename, regexp_replace(storage_key, '^.*/', ''))
      )
    ELSE url
  END,
  storage_key = NULL,
  storage_provider = 'bundled',
  source_type = 'seed',
  mime_type = CASE
    WHEN lower(COALESCE(original_filename, url)) LIKE '%.png' THEN 'image/png'
    WHEN lower(COALESCE(original_filename, url)) LIKE '%.webp' THEN 'image/webp'
    WHEN lower(COALESCE(original_filename, url)) LIKE '%.jpg'
      OR lower(COALESCE(original_filename, url)) LIKE '%.jpeg' THEN 'image/jpeg'
    ELSE mime_type
  END
WHERE
  source_type = 'seed'
  OR url LIKE '%/sample-projects/%'
  OR url LIKE '/media/%'
  OR storage_key LIKE 'sample-projects/%'
  OR storage_key LIKE 'media/%'
  OR storage_key LIKE '%/seed/%';

COMMIT;
