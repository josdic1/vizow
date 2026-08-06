import {
  basicVowResponseSchema,
  basicVowSnapshotSchema,
  createBasicVowSchema,
  fieldNoteSchema,
  idSchema,
  mediaSchema,
  vowSchema,
  type BasicVowSnapshot,
  type FieldNote,
  type Media,
  type Vow,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { env } from "../env.js";

export const jobVowsRouter = Router();

type CompletedCycleDatabaseRow = {
  organizationId: string;
  clientId: string;
  clientName: string;
  jobId: string;
  jobTitle: string;
  serviceAddressLine1: string | null;
  serviceAddressLine2: string | null;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostalCode: string | null;
  jobCycleId: string;
  cycleNumber: number;
  stage: "project" | "completed";
  openedAt: Date;
  completedAt: Date | null;
};

type FieldNoteDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  mediaId: string | null;
  content: string;
  capturedAt: Date;
  createdAt: Date;
};

type MediaDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  url: string;
  storageKey: string | null;
  mimeType: string | null;
  stage: Media["stage"];
  caption: string | null;
  capturedAt: Date | null;
  createdAt: Date;
};

type VowDatabaseRow = {
  id: string;
  clientId: string;
  title: string;
  status: Vow["status"];
  snapshot: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function prepareFieldNote(
  row: FieldNoteDatabaseRow,
): FieldNote {
  return fieldNoteSchema.parse({
    id: row.id,
    jobId: row.jobId,
    jobCycleId: row.jobCycleId,
    mediaId: row.mediaId,
    content: row.content,
    capturedAt: row.capturedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  });
}

export function prepareMedia(
  row: MediaDatabaseRow,
): Media {
  return mediaSchema.parse({
    id: row.id,
    jobId: row.jobId,
    jobCycleId: row.jobCycleId,
    url: row.url,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    stage: row.stage,
    caption: row.caption,
    capturedAt:
      row.capturedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });
}

export function prepareVow(
  row: VowDatabaseRow,
): Vow {
  return vowSchema.parse({
    id: row.id,
    clientId: row.clientId,
    title: row.title,
    status: row.status,
    snapshot: row.snapshot,
    publishedAt:
      row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

jobVowsRouter.post(
  "/:jobId/basic-vow",
  async (request, response) => {
    const jobIdResult = idSchema.safeParse(
      request.params.jobId,
    );

    if (!jobIdResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid job ID.",
      });
      return;
    }

    const inputResult =
      createBasicVowSchema.safeParse(request.body);

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid VOW request.",
      });
      return;
    }

    const databaseClient = await pool.connect();
    let transactionCommitted = false;

    try {
      await databaseClient.query("BEGIN");

      const cycleResult =
        await databaseClient.query<CompletedCycleDatabaseRow>(
          `
            SELECT
              job.organization_id AS "organizationId",
              job.client_id AS "clientId",
              client.name AS "clientName",
              job.id AS "jobId",
              job.title AS "jobTitle",
              job.service_address_line_1
                AS "serviceAddressLine1",
              job.service_address_line_2
                AS "serviceAddressLine2",
              job.service_city AS "serviceCity",
              job.service_state AS "serviceState",
              job.service_postal_code
                AS "servicePostalCode",
              cycle.id AS "jobCycleId",
              cycle.cycle_number AS "cycleNumber",
              cycle.stage,
              cycle.opened_at AS "openedAt",
              cycle.completed_at AS "completedAt"
            FROM jobs job
            JOIN organizations organization
              ON organization.id = job.organization_id
            JOIN clients client
              ON client.organization_id =
                job.organization_id
             AND client.id = job.client_id
            JOIN job_cycles cycle
              ON cycle.organization_id =
                job.organization_id
             AND cycle.job_id = job.id
             AND cycle.cycle_number = (
               SELECT MAX(candidate.cycle_number)
               FROM job_cycles candidate
               WHERE candidate.organization_id =
                 job.organization_id
                 AND candidate.job_id = job.id
             )
            WHERE job.id = $1
              AND organization.slug = $2
            FOR UPDATE OF cycle
          `,
          [
            jobIdResult.data,
            env.ORGANIZATION_SLUG,
          ],
        );

      const cycle = cycleResult.rows[0];

      if (!cycle) {
        await databaseClient.query("ROLLBACK");

        response.status(404).json({
          ok: false,
          error: "Job was not found.",
        });
        return;
      }

      if (
        cycle.stage !== "completed" ||
        !cycle.completedAt
      ) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Close the current work cycle before generating a VOW.",
        });
        return;
      }

      const existingResult =
        await databaseClient.query<VowDatabaseRow>(
          `
            SELECT
              vow.id,
              vow.client_id AS "clientId",
              vow.title,
              vow.status,
              vow.snapshot,
              vow.published_at AS "publishedAt",
              vow.created_at AS "createdAt",
              vow.updated_at AS "updatedAt"
            FROM vows vow
            JOIN vow_jobs vow_job
              ON vow_job.organization_id =
                vow.organization_id
             AND vow_job.client_id = vow.client_id
             AND vow_job.vow_id = vow.id
            WHERE vow_job.organization_id = $1
              AND vow_job.job_id = $2
              AND vow_job.job_cycle_id = $3
              AND vow.status = 'draft'
            ORDER BY vow.created_at DESC
            LIMIT 1
          `,
          [
            cycle.organizationId,
            cycle.jobId,
            cycle.jobCycleId,
          ],
        );

      const existingVow = existingResult.rows[0];

      if (existingVow) {
        const preparedVow = prepareVow(existingVow);
        const responsePayload = basicVowResponseSchema.parse({
          ok: true,
          vow: preparedVow,
        });

        await databaseClient.query("COMMIT");
        transactionCommitted = true;

        response.json(responsePayload);
        return;
      }

      const fieldNoteResult =
        await databaseClient.query<FieldNoteDatabaseRow>(
          `
            SELECT
              note.id,
              note.job_id AS "jobId",
              note.job_cycle_id AS "jobCycleId",
              note.media_id AS "mediaId",
              note.content,
              note.captured_at AS "capturedAt",
              note.created_at AS "createdAt"
            FROM field_notes note
            WHERE note.organization_id = $1
              AND note.job_id = $2
              AND note.job_cycle_id = $3
            ORDER BY
              note.captured_at,
              note.created_at
          `,
          [
            cycle.organizationId,
            cycle.jobId,
            cycle.jobCycleId,
          ],
        );

      const mediaResult =
        await databaseClient.query<MediaDatabaseRow>(
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
              media.created_at AS "createdAt"
            FROM media
            WHERE media.organization_id = $1
              AND media.job_id = $2
              AND media.job_cycle_id = $3
              AND media.is_redacted = false
            ORDER BY
              CASE media.stage
                WHEN 'before' THEN 1
                WHEN 'during' THEN 2
                WHEN 'after' THEN 3
              END,
              media.created_at
          `,
          [
            cycle.organizationId,
            cycle.jobId,
            cycle.jobCycleId,
          ],
        );

      const fieldNotes =
        fieldNoteResult.rows.map(prepareFieldNote);

      const media =
        mediaResult.rows.map(prepareMedia);

      if (
        fieldNotes.length === 0 &&
        media.length === 0
      ) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Add a field note or photo before generating a VOW.",
        });
        return;
      }

      const snapshot: BasicVowSnapshot =
        basicVowSnapshotSchema.parse({
          client: {
            id: cycle.clientId,
            name: cycle.clientName,
          },
          job: {
            id: cycle.jobId,
            title: cycle.jobTitle,
            serviceAddressLine1:
              cycle.serviceAddressLine1,
            serviceAddressLine2:
              cycle.serviceAddressLine2,
            serviceCity: cycle.serviceCity,
            serviceState: cycle.serviceState,
            servicePostalCode:
              cycle.servicePostalCode,
          },
          cycle: {
            id: cycle.jobCycleId,
            cycleNumber: cycle.cycleNumber,
            openedAt: cycle.openedAt.toISOString(),
            completedAt:
              cycle.completedAt.toISOString(),
          },
          fieldNotes,
          media,
        });

      const title =
        `${cycle.jobTitle} · Cycle ${cycle.cycleNumber}`;

      const vowResult =
        await databaseClient.query<VowDatabaseRow>(
          `
            INSERT INTO vows (
              organization_id,
              client_id,
              title,
              status,
              snapshot
            )
            VALUES ($1, $2, $3, 'draft', $4::jsonb)
            RETURNING
              id,
              client_id AS "clientId",
              title,
              status,
              snapshot,
              published_at AS "publishedAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            cycle.organizationId,
            cycle.clientId,
            title,
            JSON.stringify(snapshot),
          ],
        );

      const createdVow = vowResult.rows[0];

      if (!createdVow) {
        throw new Error(
          "PostgreSQL did not return the created VOW.",
        );
      }

      await databaseClient.query(
        `
          INSERT INTO vow_jobs (
            organization_id,
            client_id,
            vow_id,
            job_id,
            job_cycle_id,
            display_order
          )
          VALUES ($1, $2, $3, $4, $5, 0)
        `,
        [
          cycle.organizationId,
          cycle.clientId,
          createdVow.id,
          cycle.jobId,
          cycle.jobCycleId,
        ],
      );

      for (
        const [displayOrder, photo]
        of media.entries()
      ) {
        await databaseClient.query(
          `
            INSERT INTO vow_media (
              organization_id,
              client_id,
              vow_id,
              job_cycle_id,
              media_id,
              display_order
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            cycle.organizationId,
            cycle.clientId,
            createdVow.id,
            cycle.jobCycleId,
            photo.id,
            displayOrder,
          ],
        );
      }

      await databaseClient.query(
        `
          INSERT INTO job_events (
            organization_id,
            job_id,
            job_cycle_id,
            event_type,
            details
          )
          VALUES (
            $1,
            $2,
            $3,
            'vow_created',
            jsonb_build_object(
              'vowId',
              $4::uuid,
              'cycleNumber',
              $5::integer,
              'fieldNoteCount',
              $6::integer,
              'mediaCount',
              $7::integer
            )
          )
        `,
        [
          cycle.organizationId,
          cycle.jobId,
          cycle.jobCycleId,
          createdVow.id,
          cycle.cycleNumber,
          fieldNotes.length,
          media.length,
        ],
      );

      const preparedVow = prepareVow(createdVow);
      const responsePayload = basicVowResponseSchema.parse({
        ok: true,
        vow: preparedVow,
      });

      await databaseClient.query("COMMIT");
      transactionCommitted = true;

      response.status(201).json(responsePayload);
    } catch (error) {
      if (!transactionCommitted) {
        await databaseClient.query("ROLLBACK");
      }

      console.error(error);

      if (!response.headersSent) {
        response.status(500).json({
          ok: false,
          error: "Unable to generate the VOW.",
        });
      }
    } finally {
      databaseClient.release();
    }
  },
);
