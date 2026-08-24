-- Built-in demo photos are immutable frontend assets.
-- Every private demo workspace references the same files under /media/.
-- Real user uploads continue to use Cloudinary.

UPDATE media
SET
  storage_key = regexp_replace(storage_key, '^sample-projects/', 'media/'),
  url = regexp_replace(url, '^/sample-projects/', '/media/'),
  mime_type = 'image/png'
WHERE storage_provider = 'bundled'
  AND source_type = 'seed'
  AND (
    storage_key LIKE 'sample-projects/%'
    OR url LIKE '/sample-projects/%'
  );
