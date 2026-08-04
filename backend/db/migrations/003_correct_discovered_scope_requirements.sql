BEGIN;

UPDATE scope_revisions revision
SET visit_requirement = 'undecided'
WHERE revision.visit_requirement = 'required'
  AND EXISTS (
    SELECT 1
    FROM scope_revision_visits link
    WHERE link.scope_revision_id = revision.id
      AND link.relationship_type = 'discovered_during'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM scope_revision_visits link
    WHERE link.scope_revision_id = revision.id
      AND link.relationship_type = 'planned_for'
  );

COMMIT;
