BEGIN;

CREATE TYPE job_lifecycle_status AS ENUM (
  'active',
  'cancelled'
);

ALTER TABLE jobs
  ADD COLUMN lifecycle_status job_lifecycle_status
    NOT NULL DEFAULT 'active',
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancellation_reason TEXT,
  ADD COLUMN archived_at TIMESTAMPTZ;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_cancellation_state_check
  CHECK (
    (
      lifecycle_status = 'active'
      AND cancelled_at IS NULL
      AND cancellation_reason IS NULL
    )
    OR
    (
      lifecycle_status = 'cancelled'
      AND cancelled_at IS NOT NULL
      AND cancellation_reason IS NOT NULL
      AND btrim(cancellation_reason) <> ''
    )
  );

CREATE INDEX jobs_organization_lifecycle_archive_idx
  ON jobs (
    organization_id,
    lifecycle_status,
    archived_at,
    updated_at DESC
  );

CREATE OR REPLACE FUNCTION enforce_job_archive_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  latest_cycle_stage job_stage;
BEGIN
  IF NEW.archived_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cycle.stage
  INTO latest_cycle_stage
  FROM job_cycles cycle
  WHERE cycle.organization_id = NEW.organization_id
    AND cycle.job_id = NEW.id
  ORDER BY cycle.cycle_number DESC
  LIMIT 1;

  IF NEW.lifecycle_status <> 'cancelled'
     AND latest_cycle_stage IS DISTINCT FROM 'completed'
  THEN
    RAISE EXCEPTION
      'Only completed or cancelled Jobs can be archived.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_archive_eligibility_trigger
BEFORE INSERT OR UPDATE OF
  lifecycle_status,
  archived_at
ON jobs
FOR EACH ROW
EXECUTE FUNCTION enforce_job_archive_eligibility();

COMMIT;
