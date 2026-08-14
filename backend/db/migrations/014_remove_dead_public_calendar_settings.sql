BEGIN;

ALTER TABLE public_calendar_settings
  DROP COLUMN working_days,
  DROP COLUMN workday_start,
  DROP COLUMN workday_end;

COMMIT;
