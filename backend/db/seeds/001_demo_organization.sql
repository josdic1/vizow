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
ON CONFLICT (slug) DO NOTHING;

SELECT
  id,
  name,
  slug,
  brand_settings
FROM organizations
WHERE slug = 'vizow-demo';
