BEGIN;

CREATE TYPE media_storage_provider AS ENUM (
  'cloudinary',
  'bundled'
);

CREATE TYPE media_source_type AS ENUM (
  'seed',
  'uploaded'
);

ALTER TABLE media
  ADD COLUMN storage_provider media_storage_provider,
  ADD COLUMN source_type media_source_type;

UPDATE media
SET
  source_type = CASE
    WHEN url LIKE '%/sample-projects/%' THEN 'seed'::media_source_type
    ELSE 'uploaded'::media_source_type
  END,
  storage_provider = CASE
    WHEN storage_key IS NOT NULL THEN 'cloudinary'::media_storage_provider
    ELSE 'bundled'::media_storage_provider
  END;

ALTER TABLE media
  ALTER COLUMN storage_provider SET NOT NULL,
  ALTER COLUMN source_type SET NOT NULL;

ALTER TABLE media
  ADD CONSTRAINT media_cloudinary_requires_storage_key
  CHECK (
    storage_provider <> 'cloudinary'
    OR storage_key IS NOT NULL
  );

CREATE INDEX media_storage_cleanup_idx
  ON media (organization_id, source_type, storage_provider)
  WHERE storage_key IS NOT NULL;

ALTER TABLE organizations
  ADD COLUMN demo_media_cleaned_at TIMESTAMPTZ;

COMMIT;
