# Media storage truth

Vizow has two intentional media sources.

## Demo fixtures

Curated sample photos live in `frontend/public/media` and ship with the frontend.
They are immutable product/demo fixtures, so they are not copied to Cloudinary.

Database rows use:

- `storage_provider = bundled`
- `source_type = seed`
- `storage_key = media/<project>/<file>`
- `url = /media/<project>/<file>`

The relative delivery URL follows the frontend origin automatically, so it works on local dev,
Netlify, a phone, and a future custom domain without embedding `localhost` or a host name.

## User uploads

Photos captured or uploaded by a user are normalized by the backend and persisted to Cloudinary.
Their database rows use:

- `storage_provider = cloudinary`
- `source_type = uploaded`
- `storage_key = <Cloudinary public_id>`
- `url = <Cloudinary secure delivery URL>`

Workspace/job/request IDs partition uploaded assets. Demo reset and expiry cleanup delete only
`cloudinary + uploaded` media. Bundled seed fixtures are never copied or deleted.
