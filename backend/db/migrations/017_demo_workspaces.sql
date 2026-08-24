BEGIN;

ALTER TABLE organizations
  ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN demo_expires_at TIMESTAMPTZ;

CREATE TABLE demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,

  FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE CASCADE
);

CREATE INDEX demo_sessions_organization_id_idx
  ON demo_sessions (organization_id);

CREATE INDEX demo_sessions_expires_at_idx
  ON demo_sessions (expires_at);

COMMIT;
