-- Media remains canonical Job evidence. These flags only control presentation.
ALTER TABLE media
  ADD COLUMN vow_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN exclude_from_outputs BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX media_job_vow_featured_idx
  ON media (organization_id, job_id, vow_featured, created_at DESC);
