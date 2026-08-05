BEGIN;

ALTER TABLE requests
  ADD COLUMN decline_reason TEXT;

ALTER TABLE requests
  ADD CONSTRAINT requests_decline_reason_state_check
  CHECK (
    (
      status = 'declined'
      AND decline_reason IS NOT NULL
      AND btrim(decline_reason) <> ''
      AND char_length(decline_reason) <= 1000
    )
    OR
    (
      status <> 'declined'
      AND decline_reason IS NULL
    )
  );

COMMIT;
