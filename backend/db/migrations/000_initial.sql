BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE job_stage AS ENUM (
  'request',
  'project',
  'completed'
);

CREATE TYPE cycle_reason AS ENUM (
  'original',
  'reopened'
);

CREATE TYPE media_stage AS ENUM (
  'before',
  'during',
  'after'
);

CREATE TYPE visit_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled'
);

CREATE TYPE dispute_status AS ENUM (
  'open',
  'resolved',
  'withdrawn'
);

CREATE TYPE vow_status AS ENUM (
  'draft',
  'published',
  'archived'
);

CREATE TYPE vow_output_type AS ENUM (
  'web',
  'pdf',
  'social'
);

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  brand_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (id, slug)
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),

  FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE RESTRICT
);

CREATE TABLE jobs (
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

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),
  UNIQUE (organization_id, client_id, id),

  FOREIGN KEY (organization_id, client_id)
    REFERENCES clients(organization_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE job_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  cycle_number INTEGER NOT NULL,
  reason cycle_reason NOT NULL,
  stage job_stage NOT NULL DEFAULT 'request',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),
  UNIQUE (organization_id, job_id, id),
  UNIQUE (job_id, cycle_number),

  CHECK (cycle_number > 0),

  CHECK (
    (cycle_number = 1 AND reason = 'original')
    OR
    (cycle_number > 1 AND reason = 'reopened')
  ),

  CHECK (
    (stage = 'completed' AND completed_at IS NOT NULL)
    OR
    (stage <> 'completed' AND completed_at IS NULL)
  ),

  FOREIGN KEY (organization_id, job_id)
    REFERENCES jobs(organization_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_cycle_id UUID,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (organization_id, job_id)
    REFERENCES jobs(organization_id, id)
    ON DELETE RESTRICT,

  FOREIGN KEY (organization_id, job_id, job_cycle_id)
    REFERENCES job_cycles(organization_id, job_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE scope_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_cycle_id UUID NOT NULL,
  revision_number INTEGER NOT NULL,
  scope_text TEXT NOT NULL,
  price_change NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (job_cycle_id, revision_number),

  CHECK (revision_number > 0),

  FOREIGN KEY (organization_id, job_id, job_cycle_id)
    REFERENCES job_cycles(organization_id, job_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_cycle_id UUID NOT NULL,
  status visit_status NOT NULL DEFAULT 'scheduled',
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    scheduled_end IS NULL
    OR scheduled_end > scheduled_start
  ),

  FOREIGN KEY (organization_id, job_id, job_cycle_id)
    REFERENCES job_cycles(organization_id, job_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_cycle_id UUID NOT NULL UNIQUE,
  final_price NUMERIC(12,2),
  completion_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (final_price IS NULL OR final_price >= 0),

  FOREIGN KEY (organization_id, job_id, job_cycle_id)
    REFERENCES job_cycles(organization_id, job_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_cycle_id UUID NOT NULL,
  url TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  stage media_stage NOT NULL DEFAULT 'during',
  caption TEXT,
  is_redacted BOOLEAN NOT NULL DEFAULT false,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),
  UNIQUE (organization_id, job_cycle_id, id),

  FOREIGN KEY (organization_id, job_id, job_cycle_id)
    REFERENCES job_cycles(organization_id, job_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_cycle_id UUID NOT NULL,
  status dispute_status NOT NULL DEFAULT 'open',
  reason TEXT NOT NULL,
  resolution_notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    (status = 'resolved' AND resolved_at IS NOT NULL)
    OR
    (status <> 'resolved' AND resolved_at IS NULL)
  ),

  FOREIGN KEY (organization_id, job_id, job_cycle_id)
    REFERENCES job_cycles(organization_id, job_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE vows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,
  title TEXT NOT NULL,
  status vow_status NOT NULL DEFAULT 'draft',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),
  UNIQUE (organization_id, client_id, id),

  CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR
    (status <> 'published' AND published_at IS NULL)
  ),

  FOREIGN KEY (organization_id, client_id)
    REFERENCES clients(organization_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE vow_jobs (
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,
  vow_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_cycle_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (vow_id, job_cycle_id),

  CHECK (display_order >= 0),

  FOREIGN KEY (organization_id, client_id, vow_id)
    REFERENCES vows(organization_id, client_id, id)
    ON DELETE RESTRICT,

  FOREIGN KEY (organization_id, client_id, job_id)
    REFERENCES jobs(organization_id, client_id, id)
    ON DELETE RESTRICT,

  FOREIGN KEY (organization_id, job_id, job_cycle_id)
    REFERENCES job_cycles(organization_id, job_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE vow_media (
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,
  vow_id UUID NOT NULL,
  job_cycle_id UUID NOT NULL,
  media_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (vow_id, media_id),

  CHECK (display_order >= 0),

  FOREIGN KEY (organization_id, client_id, vow_id)
    REFERENCES vows(organization_id, client_id, id)
    ON DELETE RESTRICT,

  FOREIGN KEY (vow_id, job_cycle_id)
    REFERENCES vow_jobs(vow_id, job_cycle_id)
    ON DELETE RESTRICT,

  FOREIGN KEY (organization_id, job_cycle_id, media_id)
    REFERENCES media(organization_id, job_cycle_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE vow_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,
  vow_id UUID NOT NULL,
  output_type vow_output_type NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (organization_id, client_id, vow_id)
    REFERENCES vows(organization_id, client_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX clients_organization_idx
  ON clients (organization_id);

CREATE INDEX jobs_organization_client_idx
  ON jobs (organization_id, client_id);

CREATE INDEX job_cycles_job_number_idx
  ON job_cycles (job_id, cycle_number DESC);

CREATE INDEX job_cycles_organization_stage_idx
  ON job_cycles (organization_id, stage);

CREATE INDEX job_events_job_created_idx
  ON job_events (job_id, created_at DESC);

CREATE INDEX scope_revisions_cycle_revision_idx
  ON scope_revisions (job_cycle_id, revision_number DESC);

CREATE INDEX visits_cycle_schedule_idx
  ON visits (job_cycle_id, scheduled_start);

CREATE INDEX media_cycle_stage_created_idx
  ON media (job_cycle_id, stage, created_at DESC);

CREATE INDEX disputes_cycle_status_idx
  ON disputes (job_cycle_id, status);

CREATE INDEX vows_client_created_idx
  ON vows (client_id, created_at DESC);

CREATE INDEX vow_outputs_vow_created_idx
  ON vow_outputs (vow_id, created_at DESC);

CREATE VIEW current_job_cycles AS
SELECT DISTINCT ON (organization_id, job_id)
  organization_id,
  job_id,
  id AS job_cycle_id,
  cycle_number,
  reason,
  stage,
  opened_at,
  completed_at,
  created_at,
  updated_at
FROM job_cycles
ORDER BY organization_id, job_id, cycle_number DESC;

COMMIT;
