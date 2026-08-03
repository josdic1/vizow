BEGIN;

INSERT INTO organizations (
  name,
  slug,
  brand_settings
)
VALUES (
  'Vizow Demo',
  'vizow-demo',
  '{"product_name": "Vizow"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  brand_settings = EXCLUDED.brand_settings,
  updated_at = now();

INSERT INTO clients (
  id,
  organization_id,
  name,
  email,
  phone,
  notes
)
SELECT
  '932e5e38-ccde-4d74-b5af-70b8c39386bb',
  organization.id,
  'Sample Client',
  NULL,
  NULL,
  'Demo client for local VIZOW development.'
FROM organizations organization
WHERE organization.slug = 'vizow-demo'
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  notes = EXCLUDED.notes,
  archived_at = NULL,
  updated_at = now();

INSERT INTO client_addresses (
  organization_id,
  client_id,
  label,
  is_default,
  address_line_1,
  address_line_2,
  city,
  state,
  postal_code
)
SELECT
  client.organization_id,
  client.id,
  'Primary',
  true,
  '123 Sample Street',
  NULL,
  'South Orange',
  'NJ',
  '07079'
FROM clients client
JOIN organizations organization
  ON organization.id = client.organization_id
WHERE organization.slug = 'vizow-demo'
  AND client.id = '932e5e38-ccde-4d74-b5af-70b8c39386bb'
ON CONFLICT (organization_id, client_id)
  WHERE is_default
    AND archived_at IS NULL
DO UPDATE SET
  label = EXCLUDED.label,
  address_line_1 = EXCLUDED.address_line_1,
  address_line_2 = EXCLUDED.address_line_2,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  postal_code = EXCLUDED.postal_code,
  updated_at = now();

COMMIT;

SELECT
  organization.name AS organization,
  organization.slug,
  client.name AS client,
  address.label,
  address.is_default,
  address.address_line_1,
  address.city,
  address.state,
  address.postal_code
FROM organizations organization
JOIN clients client
  ON client.organization_id = organization.id
JOIN client_addresses address
  ON address.organization_id = client.organization_id
 AND address.client_id = client.id
WHERE organization.slug = 'vizow-demo'
  AND client.id = '932e5e38-ccde-4d74-b5af-70b8c39386bb';
