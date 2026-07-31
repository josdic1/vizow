BEGIN;

CREATE TABLE field_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL,
  job_id uuid NOT NULL,
  job_cycle_id uuid NOT NULL,
  media_id uuid,

  content text NOT NULL
    CHECK (btrim(content) <> ''),

  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  UNIQUE (organization_id, job_cycle_id, id),

  FOREIGN KEY (
    organization_id,
    job_id,
    job_cycle_id
  )
  REFERENCES job_cycles (
    organization_id,
    job_id,
    id
  )
  ON DELETE RESTRICT,

  FOREIGN KEY (
    organization_id,
    job_cycle_id,
    media_id
  )
  REFERENCES media (
    organization_id,
    job_cycle_id,
    id
  )
  ON DELETE RESTRICT
);

CREATE INDEX field_notes_cycle_captured_idx
  ON field_notes (
    job_cycle_id,
    captured_at DESC,
    created_at DESC
  );

CREATE INDEX field_notes_media_idx
  ON field_notes (media_id)
  WHERE media_id IS NOT NULL;

COMMIT;
