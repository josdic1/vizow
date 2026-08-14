BEGIN;

-- A Request is now the intake record. Public messages no longer pass through
-- a separate Submission lifecycle before the contractor can review them.
ALTER TABLE requests
  ADD COLUMN submitted_name TEXT,
  ADD COLUMN submitted_email TEXT,
  ADD COLUMN submitted_phone TEXT,
  ADD COLUMN preferred_timing TEXT,
  ADD COLUMN preferred_contact TEXT;

ALTER TABLE requests
  DROP CONSTRAINT requests_organization_id_client_id_approved_job_id_fkey;

ALTER TABLE requests
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE requests
  ADD CONSTRAINT requests_approved_job_fkey
  FOREIGN KEY (organization_id, approved_job_id)
  REFERENCES jobs(organization_id, id)
  ON DELETE RESTRICT;

CREATE TABLE request_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  request_id UUID NOT NULL,
  media_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, request_id, id),
  UNIQUE (organization_id, media_id),

  FOREIGN KEY (organization_id, request_id)
    REFERENCES requests(organization_id, id)
    ON DELETE RESTRICT,

  FOREIGN KEY (organization_id, media_id)
    REFERENCES media(organization_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX request_media_request_idx
  ON request_media (organization_id, request_id, created_at);

-- Converted intake already has a canonical Request. Preserve its source
-- information on that Request.
UPDATE requests AS request
SET
  submitted_name = submission.submitted_name,
  submitted_email = submission.submitted_email,
  submitted_phone = submission.submitted_phone,
  preferred_timing = submission.preferred_timing,
  preferred_contact = submission.preferred_contact
FROM submissions AS submission
WHERE submission.organization_id = request.organization_id
  AND submission.converted_request_id = request.id;

-- Unresolved intake becomes an open Request directly. The generated title is
-- only an inbox label; the contractor confirms the canonical title before
-- approval.
INSERT INTO requests (
  id,
  organization_id,
  client_id,
  client_address_id,
  title,
  description,
  service_address_line_1,
  service_address_line_2,
  service_city,
  service_state,
  service_postal_code,
  status,
  decline_reason,
  submitted_name,
  submitted_email,
  submitted_phone,
  preferred_timing,
  preferred_contact,
  submitted_at,
  decided_at,
  created_at,
  updated_at
)
SELECT
  submission.id,
  submission.organization_id,
  NULL,
  NULL,
  CASE
    WHEN btrim(COALESCE(submission.description, '')) <> ''
      THEN left(regexp_replace(btrim(submission.description), E'[\\n\\r]+', ' ', 'g'), 120)
    WHEN btrim(COALESCE(submission.submitted_name, '')) <> ''
      THEN 'Request from ' || btrim(submission.submitted_name)
    ELSE 'Incoming request'
  END,
  submission.description,
  submission.service_address_line_1,
  submission.service_address_line_2,
  submission.service_city,
  submission.service_state,
  submission.service_postal_code,
  CASE
    WHEN submission.status IN ('rejected', 'spam') THEN 'declined'::request_status
    ELSE 'open'::request_status
  END,
  CASE
    WHEN submission.status = 'spam' THEN 'Marked as spam during intake review.'
    WHEN submission.status = 'rejected' THEN 'Declined during intake review.'
    ELSE NULL
  END,
  submission.submitted_name,
  submission.submitted_email,
  submission.submitted_phone,
  submission.preferred_timing,
  submission.preferred_contact,
  submission.submitted_at,
  CASE
    WHEN submission.status IN ('rejected', 'spam')
      THEN submission.status_updated_at
    ELSE NULL
  END,
  submission.submitted_at,
  submission.status_updated_at
FROM submissions AS submission
WHERE submission.converted_request_id IS NULL;

INSERT INTO request_media (
  id,
  organization_id,
  request_id,
  media_id,
  created_at
)
SELECT
  submission_media.id,
  submission_media.organization_id,
  COALESCE(submission.converted_request_id, submission.id),
  submission_media.media_id,
  submission_media.created_at
FROM submission_media
JOIN submissions AS submission
  ON submission.organization_id = submission_media.organization_id
 AND submission.id = submission_media.submission_id;

DROP TRIGGER IF EXISTS submission_ai_analyses_append_only
  ON submission_ai_analyses;
DROP TRIGGER IF EXISTS submissions_protect_raw_input ON submissions;
DROP FUNCTION IF EXISTS prevent_submission_ai_analysis_mutation();
DROP FUNCTION IF EXISTS protect_submission_raw_input();
DROP TABLE submission_ai_analyses;
DROP TABLE submission_media;
DROP TABLE submissions;
DROP TYPE submission_status;

COMMIT;
