import {
  mediaLibraryResponseSchema,
  mediaLibraryItemSchema,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { getOrganizationSlug } from "../organizationScope.js";

export const mediaLibraryRouter = Router();

type MediaLibraryDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  url: string;
  storageKey: string | null;
  mimeType: string | null;
  stage: "before" | "during" | "after";
  caption: string | null;
  capturedAt: Date | null;
  createdAt: Date;
  jobTitle: string;
  clientId: string;
  clientName: string;
  cycleNumber: number;
  serviceAddressLine1: string | null;
  serviceAddressLine2: string | null;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostalCode: string | null;
  attachedNote: string | null;
};

mediaLibraryRouter.get("/", async (_request, response) => {
  try {
    const result = await pool.query<MediaLibraryDatabaseRow>(
      `
        SELECT
          media.id,
          media.job_id AS "jobId",
          media.job_cycle_id AS "jobCycleId",
          media.url,
          media.storage_key AS "storageKey",
          media.mime_type AS "mimeType",
          media.stage,
          media.caption,
          media.captured_at AS "capturedAt",
          media.created_at AS "createdAt",
          job.title AS "jobTitle",
          job.client_id AS "clientId",
          client.name AS "clientName",
          cycle.cycle_number AS "cycleNumber",
          job.service_address_line_1 AS "serviceAddressLine1",
          job.service_address_line_2 AS "serviceAddressLine2",
          job.service_city AS "serviceCity",
          job.service_state AS "serviceState",
          job.service_postal_code AS "servicePostalCode",
          note.content AS "attachedNote"
        FROM media
        JOIN organizations organization
          ON organization.id = media.organization_id
        JOIN jobs job
          ON job.organization_id = media.organization_id
         AND job.id = media.job_id
        JOIN clients client
          ON client.organization_id = job.organization_id
         AND client.id = job.client_id
        JOIN job_cycles cycle
          ON cycle.organization_id = media.organization_id
         AND cycle.job_id = media.job_id
         AND cycle.id = media.job_cycle_id
        LEFT JOIN LATERAL (
          SELECT field_note.content
          FROM field_notes field_note
          WHERE field_note.organization_id = media.organization_id
            AND field_note.job_id = media.job_id
            AND field_note.job_cycle_id = media.job_cycle_id
            AND field_note.media_id = media.id
          ORDER BY field_note.created_at DESC
          LIMIT 1
        ) note ON true
        WHERE organization.slug = $1
        ORDER BY
          COALESCE(media.captured_at, media.created_at) DESC,
          media.created_at DESC,
          media.id
      `,
      [getOrganizationSlug()],
    );

    const payload = mediaLibraryResponseSchema.parse({
      ok: true,
      media: result.rows.map((row) =>
        mediaLibraryItemSchema.parse({
          ...row,
          capturedAt: row.capturedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        }),
      ),
    });

    response.json(payload);
  } catch (error) {
    console.error(error);
    response.status(500).json({
      ok: false,
      error: "Unable to load Media Library.",
    });
  }
});
