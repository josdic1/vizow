BEGIN;

-- Demo/sample photos are immutable frontend fixtures, not user-owned uploads.
-- Normalize any legacy localhost URL or briefly-promoted Cloudinary seed row
-- back to an origin-neutral bundled path. Cloudinary remains canonical only
-- for source_type = 'uploaded'.
WITH normalized_seed AS (
  SELECT
    id,
    CASE
      WHEN url LIKE '%/sample-projects/%' THEN
        'sample-projects/' || split_part(url, '/sample-projects/', 2)
      WHEN storage_key LIKE '%/seed/%' THEN
        'sample-projects/' || regexp_replace(
          split_part(storage_key, '/seed/', 2),
          '[^/]+$',
          COALESCE(original_filename, regexp_replace(storage_key, '^.*/', ''))
        )
      ELSE NULL
    END AS bundled_key
  FROM media
  WHERE source_type = 'seed'
)
UPDATE media
SET
  storage_provider = 'bundled',
  storage_key = normalized_seed.bundled_key,
  url = '/' || normalized_seed.bundled_key,
  mime_type = CASE
    WHEN lower(normalized_seed.bundled_key) LIKE '%.png' THEN 'image/png'
    WHEN lower(normalized_seed.bundled_key) LIKE '%.webp' THEN 'image/webp'
    ELSE mime_type
  END
FROM normalized_seed
WHERE media.id = normalized_seed.id
  AND normalized_seed.bundled_key IS NOT NULL;

COMMIT;
