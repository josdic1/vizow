import {
  basicVowResponseSchema,
  idSchema,
  vowSchema,
  vowsResponseSchema,
  type Vow,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { getOrganizationSlug } from "../organizationScope.js";

export const vowsRouter = Router();

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

function prepareVow(row: VowDatabaseRow): Vow {
  return vowSchema.parse({
    id: row.id,
    clientId: row.clientId,
    title: row.title,
    status: row.status,
    snapshot: row.snapshot,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

vowsRouter.get("/", async (request, response) => {
  const rawJobId = request.query.jobId;

  if (
    rawJobId !== undefined &&
    typeof rawJobId !== "string"
  ) {
    response.status(400).json({
      ok: false,
      error: "Invalid job ID.",
    });
    return;
  }

  const jobIdResult = rawJobId
    ? idSchema.safeParse(rawJobId)
    : null;

  if (jobIdResult && !jobIdResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid job ID.",
    });
    return;
  }

  try {
    const result = await pool.query<VowDatabaseRow>(
      `
        SELECT DISTINCT
          vow.id,
          vow.client_id AS "clientId",
          vow.title,
          vow.status,
          vow.snapshot,
          vow.published_at AS "publishedAt",
          vow.created_at AS "createdAt",
          vow.updated_at AS "updatedAt"
        FROM vows vow
        JOIN organizations organization
          ON organization.id = vow.organization_id
        JOIN vow_jobs vow_job
          ON vow_job.organization_id = vow.organization_id
         AND vow_job.client_id = vow.client_id
         AND vow_job.vow_id = vow.id
        WHERE organization.slug = $1
          AND vow.status <> 'archived'
          AND ($2::uuid IS NULL OR vow_job.job_id = $2)
        ORDER BY vow.created_at DESC, vow.id
      `,
      [
        getOrganizationSlug(),
        jobIdResult?.success ? jobIdResult.data : null,
      ],
    );

    const payload = vowsResponseSchema.parse({
      ok: true,
      vows: result.rows.map(prepareVow),
    });

    response.json(payload);
  } catch (error) {
    console.error(error);
    response.status(500).json({
      ok: false,
      error: "Unable to load VOWs.",
    });
  }
});

vowsRouter.get("/:vowId", async (request, response) => {
  const vowIdResult = idSchema.safeParse(
    request.params.vowId,
  );

  if (!vowIdResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid VOW ID.",
    });
    return;
  }

  try {
    const result = await pool.query<VowDatabaseRow>(
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
        JOIN organizations organization
          ON organization.id = vow.organization_id
        WHERE organization.slug = $1
          AND vow.id = $2
      `,
      [getOrganizationSlug(), vowIdResult.data],
    );

    const vow = result.rows[0];

    if (!vow) {
      response.status(404).json({
        ok: false,
        error: "VOW was not found.",
      });
      return;
    }

    const payload = basicVowResponseSchema.parse({
      ok: true,
      vow: prepareVow(vow),
    });

    response.json(payload);
  } catch (error) {
    console.error(error);
    response.status(500).json({
      ok: false,
      error: "Unable to load the VOW.",
    });
  }
});
