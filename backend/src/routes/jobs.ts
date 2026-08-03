import {
  createFieldNoteSchema,
  fieldNoteSchema,
  idSchema,
  jobSchema,
  type FieldNote,
  type Job,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { env } from "../env.js";

export const jobsRouter = Router();

type JobDatabaseRow = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string | null;
  serviceAddressLine1: string | null;
  serviceAddressLine2: string | null;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostalCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  cycleId: string;
  cycleNumber: number;
  cycleReason: Job["currentCycle"]["reason"];
  cycleStage: Job["currentCycle"]["stage"];
  cycleOpenedAt: Date;
  cycleCompletedAt: Date | null;
  cycleCreatedAt: Date;
  cycleUpdatedAt: Date;
};

function prepareJob(row: JobDatabaseRow): Job {
  return jobSchema.parse({
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    title: row.title,
    description: row.description,
    serviceAddressLine1: row.serviceAddressLine1,
    serviceAddressLine2: row.serviceAddressLine2,
    serviceCity: row.serviceCity,
    serviceState: row.serviceState,
    servicePostalCode: row.servicePostalCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    currentCycle: {
      id: row.cycleId,
      cycleNumber: row.cycleNumber,
      reason: row.cycleReason,
      stage: row.cycleStage,
      openedAt: row.cycleOpenedAt.toISOString(),
      completedAt: row.cycleCompletedAt?.toISOString() ?? null,
      createdAt: row.cycleCreatedAt.toISOString(),
      updatedAt: row.cycleUpdatedAt.toISOString(),
    },
  });
}

async function loadJobs(jobId?: string): Promise<Job[]> {
  const parameters: string[] = [env.ORGANIZATION_SLUG];
  let jobFilter = "";

  if (jobId) {
    parameters.push(jobId);
    jobFilter = "AND j.id = $2";
  }

  const result = await pool.query<JobDatabaseRow>(
    `
      SELECT
        j.id,
        j.client_id AS "clientId",
        c.name AS "clientName",
        j.title,
        j.description,
        j.service_address_line_1 AS "serviceAddressLine1",
        j.service_address_line_2 AS "serviceAddressLine2",
        j.service_city AS "serviceCity",
        j.service_state AS "serviceState",
        j.service_postal_code AS "servicePostalCode",
        j.created_at AS "createdAt",
        j.updated_at AS "updatedAt",
        cycle.job_cycle_id AS "cycleId",
        cycle.cycle_number AS "cycleNumber",
        cycle.reason AS "cycleReason",
        cycle.stage AS "cycleStage",
        cycle.opened_at AS "cycleOpenedAt",
        cycle.completed_at AS "cycleCompletedAt",
        cycle.created_at AS "cycleCreatedAt",
        cycle.updated_at AS "cycleUpdatedAt"
      FROM jobs j
      JOIN clients c
        ON c.organization_id = j.organization_id
       AND c.id = j.client_id
      JOIN current_job_cycles cycle
        ON cycle.organization_id = j.organization_id
       AND cycle.job_id = j.id
      JOIN organizations organization
        ON organization.id = j.organization_id
      WHERE organization.slug = $1
        ${jobFilter}
      ORDER BY j.updated_at DESC, j.created_at DESC
    `,
    parameters,
  );

  return result.rows.map(prepareJob);
}

jobsRouter.get("/", async (_request, response) => {
  try {
    response.json({
      ok: true,
      jobs: await loadJobs(),
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to load jobs.",
    });
  }
});

jobsRouter.get("/:jobId", async (request, response) => {
  const jobIdResult = idSchema.safeParse(request.params.jobId);

  if (!jobIdResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid job ID.",
    });
    return;
  }

  try {
    const jobs = await loadJobs(jobIdResult.data);
    const job = jobs[0];

    if (!job) {
      response.status(404).json({
        ok: false,
        error: "Job was not found.",
      });
      return;
    }

    response.json({
      ok: true,
      job,
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to load job.",
    });
  }
});

type FieldNoteDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  mediaId: string | null;
  content: string;
  capturedAt: Date;
  createdAt: Date;
};

function prepareFieldNote(
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

jobsRouter.post(
  "/:jobId/field-notes",
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

    const inputResult = createFieldNoteSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid field note.",
        details: inputResult.error.flatten(),
      });
      return;
    }

    const databaseClient = await pool.connect();

    try {
      await databaseClient.query("BEGIN");

      const cycleResult = await databaseClient.query<{
        organizationId: string;
        jobCycleId: string;
        stage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            cycle.id AS "jobCycleId",
            cycle.stage
          FROM jobs job
          JOIN organizations organization
            ON organization.id = job.organization_id
          JOIN job_cycles cycle
            ON cycle.organization_id = job.organization_id
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
          FOR SHARE OF job, cycle
        `,
        [
          jobIdResult.data,
          env.ORGANIZATION_SLUG,
        ],
      );

      const currentCycle = cycleResult.rows[0];

      if (!currentCycle) {
        await databaseClient.query("ROLLBACK");

        response.status(404).json({
          ok: false,
          error: "Job was not found.",
        });
        return;
      }

      if (currentCycle.stage !== "project") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Field notes can only be added to an active work cycle.",
        });
        return;
      }

      const fieldNoteResult =
        await databaseClient.query<FieldNoteDatabaseRow>(
          `
            INSERT INTO field_notes (
              organization_id,
              job_id,
              job_cycle_id,
              content
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
              id,
              job_id AS "jobId",
              job_cycle_id AS "jobCycleId",
              media_id AS "mediaId",
              content,
              captured_at AS "capturedAt",
              created_at AS "createdAt"
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            inputResult.data.content,
          ],
        );

      const createdFieldNote = fieldNoteResult.rows[0];

      if (!createdFieldNote) {
        throw new Error(
          "PostgreSQL did not return the created field note.",
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
            'field_note_created',
            jsonb_build_object(
              'fieldNoteId',
              $4::uuid
            )
          )
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
          currentCycle.jobCycleId,
          createdFieldNote.id,
        ],
      );

      await databaseClient.query("COMMIT");

      response.status(201).json({
        ok: true,
        fieldNote: prepareFieldNote(
          createdFieldNote,
        ),
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to create field note.",
      });
    } finally {
      databaseClient.release();
    }
  },
);
