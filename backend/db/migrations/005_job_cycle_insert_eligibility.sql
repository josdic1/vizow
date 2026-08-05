BEGIN;

CREATE OR REPLACE FUNCTION enforce_job_cycle_insert_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_lifecycle_status job_lifecycle_status;
  parent_archived_at TIMESTAMPTZ;
  latest_cycle_number INTEGER;
  latest_cycle_stage job_stage;
BEGIN
  SELECT
    job.lifecycle_status,
    job.archived_at
  INTO
    parent_lifecycle_status,
    parent_archived_at
  FROM jobs job
  WHERE job.organization_id = NEW.organization_id
    AND job.id = NEW.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'The parent Job does not exist.';
  END IF;

  IF parent_archived_at IS NOT NULL THEN
    RAISE EXCEPTION
      'An archived Job cannot receive a new work cycle.';
  END IF;

  IF parent_lifecycle_status <> 'active' THEN
    RAISE EXCEPTION
      'A cancelled Job cannot receive a new work cycle.';
  END IF;

  SELECT
    cycle.cycle_number,
    cycle.stage
  INTO
    latest_cycle_number,
    latest_cycle_stage
  FROM job_cycles cycle
  WHERE cycle.organization_id = NEW.organization_id
    AND cycle.job_id = NEW.job_id
  ORDER BY cycle.cycle_number DESC
  LIMIT 1;

  IF latest_cycle_number IS NULL THEN
    IF NEW.cycle_number <> 1
       OR NEW.reason <> 'original'
    THEN
      RAISE EXCEPTION
        'The first work cycle must be original cycle 1.';
    END IF;

    RETURN NEW;
  END IF;

  IF latest_cycle_stage <> 'completed' THEN
    RAISE EXCEPTION
      'Only a completed work cycle can be reopened.';
  END IF;

  IF NEW.reason <> 'reopened'
     OR NEW.cycle_number <> latest_cycle_number + 1
  THEN
    RAISE EXCEPTION
      'A reopened work cycle must be the next cycle number.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER job_cycles_insert_eligibility_trigger
BEFORE INSERT
ON job_cycles
FOR EACH ROW
EXECUTE FUNCTION enforce_job_cycle_insert_eligibility();

COMMIT;
