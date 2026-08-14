BEGIN;

ALTER TYPE job_stage
  RENAME VALUE 'project' TO 'open';

COMMIT;
