BEGIN;

CREATE TYPE request_status AS ENUM (
  'open',
  'approved',
  'declined'
);

CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,

  title TEXT NOT NULL,
  description TEXT,

  service_address_line_1 TEXT,
  service_address_line_2 TEXT,
  service_city TEXT,
  service_state TEXT,
  service_postal_code TEXT,

  status request_status NOT NULL DEFAULT 'open',
  approved_job_id UUID,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),
  UNIQUE (organization_id, approved_job_id),

  CHECK (btrim(title) <> ''),

  CHECK (
    (
      status = 'open'
      AND decided_at IS NULL
      AND approved_job_id IS NULL
    )
    OR
    (
      status = 'approved'
      AND decided_at IS NOT NULL
      AND approved_job_id IS NOT NULL
    )
    OR
    (
      status = 'declined'
      AND decided_at IS NOT NULL
      AND approved_job_id IS NULL
    )
  ),

  FOREIGN KEY (organization_id, client_id)
    REFERENCES clients(organization_id, id)
    ON DELETE RESTRICT,

  FOREIGN KEY (organization_id, client_id, approved_job_id)
    REFERENCES jobs(organization_id, client_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  request_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (organization_id, request_id)
    REFERENCES requests(organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX requests_organization_status_created_idx
  ON requests (organization_id, status, created_at DESC);

CREATE INDEX request_events_request_created_idx
  ON request_events (request_id, created_at DESC);

-- Preserve legacy request-stage Jobs as approved Requests.
INSERT INTO requests (
  organization_id,
  client_id,
  title,
  description,
  service_address_line_1,
  service_address_line_2,
  service_city,
  service_state,
  service_postal_code,
  status,
  approved_job_id,
  submitted_at,
  decided_at,
  created_at,
  updated_at
)
SELECT
  job.organization_id,
  job.client_id,
  job.title,
  job.description,
  job.service_address_line_1,
  job.service_address_line_2,
  job.service_city,
  job.service_state,
  job.service_postal_code,
  'approved',
  job.id,
  job.created_at,
  now(),
  job.created_at,
  now()
FROM jobs job
JOIN current_job_cycles cycle
  ON cycle.organization_id = job.organization_id
 AND cycle.job_id = job.id
WHERE cycle.stage = 'request'
ON CONFLICT (organization_id, approved_job_id) DO NOTHING;

INSERT INTO request_events (
  organization_id,
  request_id,
  event_type,
  details
)
SELECT
  request.organization_id,
  request.id,
  'legacy_request_migrated',
  jsonb_build_object(
    'approvedJobId',
    request.approved_job_id,
    'previousModel',
    'job_cycle.request'
  )
FROM requests request
WHERE request.status = 'approved'
  AND request.approved_job_id IS NOT NULL;

UPDATE job_cycles cycle
SET
  stage = 'project',
  updated_at = now()
FROM requests request
JOIN current_job_cycles current_cycle
  ON current_cycle.organization_id = request.organization_id
 AND current_cycle.job_id = request.approved_job_id
WHERE cycle.organization_id = current_cycle.organization_id
  AND cycle.job_id = current_cycle.job_id
  AND cycle.id = current_cycle.job_cycle_id
  AND cycle.stage = 'request';

INSERT INTO job_events (
  organization_id,
  job_id,
  job_cycle_id,
  event_type,
  details
)
SELECT
  request.organization_id,
  request.approved_job_id,
  cycle.job_cycle_id,
  'request_approved',
  jsonb_build_object(
    'requestId',
    request.id,
    'source',
    'migration_002_requests'
  )
FROM requests request
JOIN current_job_cycles cycle
  ON cycle.organization_id = request.organization_id
 AND cycle.job_id = request.approved_job_id
WHERE request.status = 'approved'
  AND request.approved_job_id IS NOT NULL;

ALTER TABLE job_cycles
  ALTER COLUMN stage SET DEFAULT 'project';

ALTER TABLE job_cycles
  ADD CONSTRAINT job_cycles_no_request_stage
  CHECK (stage <> 'request');

COMMIT;
