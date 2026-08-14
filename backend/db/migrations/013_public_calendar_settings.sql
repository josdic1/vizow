BEGIN;

CREATE TABLE public_calendar_settings (
  organization_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  working_days SMALLINT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5]::SMALLINT[],
  workday_start TIME NOT NULL DEFAULT TIME '08:00',
  workday_end TIME NOT NULL DEFAULT TIME '17:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (cardinality(working_days) BETWEEN 1 AND 7),
  CHECK (working_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[]),
  CHECK (workday_end > workday_start),

  FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE RESTRICT
);

INSERT INTO public_calendar_settings (organization_id)
SELECT id
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

COMMIT;
