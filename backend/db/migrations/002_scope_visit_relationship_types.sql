BEGIN;

CREATE TYPE scope_visit_relationship_type AS ENUM (
  'planned_for',
  'discovered_during'
);

ALTER TABLE scope_revision_visits
  ADD COLUMN relationship_type scope_visit_relationship_type;

UPDATE scope_revision_visits link
SET relationship_type =
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM job_events event
      WHERE event.organization_id = link.organization_id
        AND event.job_id = link.job_id
        AND event.job_cycle_id = link.job_cycle_id
        AND event.event_type = 'visit_completed'
        AND event.details->>'visitId' = link.visit_id::text
        AND event.created_at <= link.created_at
    )
      THEN 'discovered_during'::scope_visit_relationship_type
    ELSE 'planned_for'::scope_visit_relationship_type
  END;

ALTER TABLE scope_revision_visits
  ALTER COLUMN relationship_type
    SET DEFAULT 'planned_for',
  ALTER COLUMN relationship_type
    SET NOT NULL;

CREATE INDEX scope_revision_visits_visit_relationship_idx
  ON scope_revision_visits (
    visit_id,
    relationship_type
  );

COMMIT;
