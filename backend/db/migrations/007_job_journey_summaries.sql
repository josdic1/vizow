BEGIN;

CREATE TABLE job_journey_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,

  summary TEXT NOT NULL,
  model TEXT NOT NULL,

  event_count INTEGER NOT NULL,
  latest_event_at TIMESTAMPTZ,

  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, job_id),

  CHECK (btrim(summary) <> ''),
  CHECK (btrim(model) <> ''),
  CHECK (event_count >= 0),

  FOREIGN KEY (organization_id, job_id)
    REFERENCES jobs(organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX job_journey_summaries_job_idx
  ON job_journey_summaries (job_id);

COMMIT;
