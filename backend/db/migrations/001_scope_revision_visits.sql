BEGIN;

CREATE TYPE scope_visit_requirement AS ENUM (
  'undecided',
  'not_required',
  'required'
);

ALTER TABLE scope_revisions
  ADD COLUMN visit_requirement scope_visit_requirement
    NOT NULL
    DEFAULT 'undecided';

ALTER TABLE scope_revisions
  ADD CONSTRAINT scope_revisions_identity_unique
  UNIQUE (
    organization_id,
    job_id,
    job_cycle_id,
    id
  );

ALTER TABLE visits
  ADD CONSTRAINT visits_identity_unique
  UNIQUE (
    organization_id,
    job_id,
    job_cycle_id,
    id
  );

CREATE TABLE scope_revision_visits (
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_cycle_id UUID NOT NULL,
  scope_revision_id UUID NOT NULL,
  visit_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (
    scope_revision_id,
    visit_id
  ),

  FOREIGN KEY (
    organization_id,
    job_id,
    job_cycle_id,
    scope_revision_id
  )
    REFERENCES scope_revisions (
      organization_id,
      job_id,
      job_cycle_id,
      id
    )
    ON DELETE RESTRICT,

  FOREIGN KEY (
    organization_id,
    job_id,
    job_cycle_id,
    visit_id
  )
    REFERENCES visits (
      organization_id,
      job_id,
      job_cycle_id,
      id
    )
    ON DELETE RESTRICT
);

CREATE INDEX scope_revisions_cycle_visit_requirement_idx
  ON scope_revisions (
    job_cycle_id,
    visit_requirement
  );

CREATE INDEX scope_revision_visits_visit_idx
  ON scope_revision_visits (visit_id);

CREATE INDEX scope_revision_visits_cycle_idx
  ON scope_revision_visits (
    job_cycle_id,
    created_at
  );

COMMIT;
