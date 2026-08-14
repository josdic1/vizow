BEGIN;

CREATE TYPE public_calendar_status AS ENUM (
  'available',
  'limited',
  'emergencies_only',
  'unavailable'
);

CREATE TABLE public_calendar_days (
  organization_id UUID NOT NULL,
  date DATE NOT NULL,
  status public_calendar_status NOT NULL,
  public_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (organization_id, date),

  FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE RESTRICT
);

CREATE INDEX public_calendar_days_organization_status_idx
  ON public_calendar_days (organization_id, status, date);

COMMIT;
