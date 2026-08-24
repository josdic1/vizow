import { pool } from "../db/pool.js";
import { deleteMediaAsset } from "./photoUpload.js";

type ExpiredDemoOrganization = {
  id: string;
};

type StorageKeyRow = {
  storageKey: string;
};

export async function cleanupExpiredDemoMedia(
  limit = 10,
): Promise<number> {
  const organizations = await pool.query<ExpiredDemoOrganization>(
    `
      SELECT id
      FROM organizations
      WHERE is_demo = true
        AND demo_expires_at <= now()
        AND demo_media_cleaned_at IS NULL
      ORDER BY demo_expires_at, id
      LIMIT $1
    `,
    [limit],
  );

  let cleaned = 0;

  for (const organization of organizations.rows) {
    const media = await pool.query<StorageKeyRow>(
      `
        SELECT storage_key AS "storageKey"
        FROM media
        WHERE organization_id = $1
          AND storage_provider = 'cloudinary'
          AND source_type = 'uploaded'
          AND storage_key IS NOT NULL
        ORDER BY id
      `,
      [organization.id],
    );

    const results = await Promise.allSettled(
      media.rows.map((row) => deleteMediaAsset(row.storageKey)),
    );
    const failed = results.some((result) => result.status === "rejected");

    if (failed) {
      console.error(
        `Cloudinary cleanup will retry for expired demo ${organization.id}.`,
      );
      continue;
    }

    await pool.query(
      `
        UPDATE organizations
        SET demo_media_cleaned_at = now()
        WHERE id = $1
          AND is_demo = true
      `,
      [organization.id],
    );

    cleaned += 1;
  }

  return cleaned;
}
