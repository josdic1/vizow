DROP INDEX IF EXISTS media_job_vow_featured_idx;

ALTER TABLE media
  DROP COLUMN IF EXISTS vow_featured,
  DROP COLUMN IF EXISTS exclude_from_outputs;
