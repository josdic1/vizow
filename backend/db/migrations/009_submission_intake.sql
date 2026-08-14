BEGIN;

CREATE TYPE submission_status AS ENUM (
  'pending',
  'needs_info',
  'converted',
  'rejected',
  'spam'
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,

  submitted_name TEXT,
  submitted_email TEXT,
  submitted_phone TEXT,

  service_address_line_1 TEXT,
  service_address_line_2 TEXT,
  service_city TEXT,
  service_state TEXT,
  service_postal_code TEXT,

  description TEXT,
  preferred_timing TEXT,
  preferred_contact TEXT,

  status submission_status NOT NULL DEFAULT 'pending',
  converted_request_id UUID,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),
  UNIQUE (organization_id, converted_request_id),

  CHECK (
    (
      status = 'converted'
      AND converted_request_id IS NOT NULL
    )
    OR
    (
      status <> 'converted'
      AND converted_request_id IS NULL
    )
  ),

  FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (organization_id, converted_request_id)
    REFERENCES requests(organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX submissions_organization_status_idx
  ON submissions (
    organization_id,
    status,
    submitted_at DESC
  );

CREATE TABLE submission_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  submission_id UUID NOT NULL,

  url TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  original_filename TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),
  UNIQUE (organization_id, submission_id, id),

  FOREIGN KEY (organization_id, submission_id)
    REFERENCES submissions(organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX submission_media_submission_idx
  ON submission_media (
    organization_id,
    submission_id,
    created_at
  );

CREATE TABLE submission_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  submission_id UUID NOT NULL,

  analysis_status TEXT NOT NULL,
  proposed_client_id UUID,

  likely_spam BOOLEAN,
  confidence NUMERIC(5,4),

  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,

  proposal JSONB,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, id),

  CHECK (
    analysis_status IN ('succeeded', 'failed')
  ),

  CHECK (
    confidence IS NULL
    OR (
      confidence >= 0
      AND confidence <= 1
    )
  ),

  CHECK (
    (
      analysis_status = 'succeeded'
      AND proposal IS NOT NULL
      AND error_message IS NULL
    )
    OR
    (
      analysis_status = 'failed'
      AND error_message IS NOT NULL
    )
  ),

  CHECK (btrim(model) <> ''),
  CHECK (btrim(prompt_version) <> ''),

  FOREIGN KEY (organization_id, submission_id)
    REFERENCES submissions(organization_id, id)
    ON DELETE RESTRICT,

  FOREIGN KEY (organization_id, proposed_client_id)
    REFERENCES clients(organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX submission_ai_analyses_latest_idx
  ON submission_ai_analyses (
    organization_id,
    submission_id,
    created_at DESC,
    id DESC
  );

ALTER TABLE requests
  ADD COLUMN client_address_id UUID;

ALTER TABLE requests
  ADD CONSTRAINT requests_client_address_fkey
  FOREIGN KEY (
    organization_id,
    client_id,
    client_address_id
  )
  REFERENCES client_addresses(
    organization_id,
    client_id,
    id
  )
  ON DELETE RESTRICT;

CREATE INDEX requests_client_address_idx
  ON requests (
    organization_id,
    client_address_id
  );

CREATE FUNCTION protect_submission_raw_input()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.submitted_name IS DISTINCT FROM OLD.submitted_name
    OR NEW.submitted_email IS DISTINCT FROM OLD.submitted_email
    OR NEW.submitted_phone IS DISTINCT FROM OLD.submitted_phone
    OR NEW.service_address_line_1 IS DISTINCT FROM OLD.service_address_line_1
    OR NEW.service_address_line_2 IS DISTINCT FROM OLD.service_address_line_2
    OR NEW.service_city IS DISTINCT FROM OLD.service_city
    OR NEW.service_state IS DISTINCT FROM OLD.service_state
    OR NEW.service_postal_code IS DISTINCT FROM OLD.service_postal_code
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.preferred_timing IS DISTINCT FROM OLD.preferred_timing
    OR NEW.preferred_contact IS DISTINCT FROM OLD.preferred_contact
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
  THEN
    RAISE EXCEPTION 'submission raw input is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER submissions_protect_raw_input
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION protect_submission_raw_input();

CREATE FUNCTION prevent_submission_ai_analysis_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'submission AI analyses are append-only';
END;
$$;

CREATE TRIGGER submission_ai_analyses_append_only
BEFORE UPDATE OR DELETE ON submission_ai_analyses
FOR EACH ROW
EXECUTE FUNCTION prevent_submission_ai_analysis_mutation();

COMMIT;
