BEGIN;

-- Media Library can own photos before a Job exists.
ALTER TABLE media
  ALTER COLUMN job_id DROP NOT NULL,
  ALTER COLUMN job_cycle_id DROP NOT NULL;

ALTER TABLE media
  ADD COLUMN original_filename TEXT;

-- Turn submission_media into a link to the existing Media Library.
ALTER TABLE submission_media
  ADD COLUMN media_id UUID;

UPDATE submission_media
SET media_id = gen_random_uuid()
WHERE media_id IS NULL;

INSERT INTO media (
  id,
  organization_id,
  job_id,
  job_cycle_id,
  url,
  storage_key,
  mime_type,
  stage,
  caption,
  is_redacted,
  captured_at,
  created_at,
  original_filename
)
SELECT
  submission_media.media_id,
  submission_media.organization_id,
  NULL,
  NULL,
  submission_media.url,
  submission_media.storage_key,
  submission_media.mime_type,
  'before'::media_stage,
  NULL,
  false,
  NULL,
  submission_media.created_at,
  submission_media.original_filename
FROM submission_media;

ALTER TABLE submission_media
  ALTER COLUMN media_id SET NOT NULL;

ALTER TABLE submission_media
  ADD CONSTRAINT submission_media_media_fk
    FOREIGN KEY (organization_id, media_id)
    REFERENCES media(organization_id, id)
    ON DELETE RESTRICT;

ALTER TABLE submission_media
  ADD CONSTRAINT submission_media_media_unique
    UNIQUE (organization_id, media_id);

ALTER TABLE submission_media
  DROP COLUMN url,
  DROP COLUMN storage_key,
  DROP COLUMN mime_type,
  DROP COLUMN original_filename;

COMMIT;
