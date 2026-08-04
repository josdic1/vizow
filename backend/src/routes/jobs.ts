import {
  closeJobCycleSchema,
  closureSchema,
  createFieldNoteSchema,
  createScopeRevisionSchema,
  createVisitSchema,
  fieldNoteSchema,
  idSchema,
  jobSchema,
  reopenJobCycleSchema,
  scopeRevisionSchema,
  updateVisitStatusSchema,
  visitSchema,
  type Closure,
  type FieldNote,
  type Job,
  type ScopeRevision,
  type Visit,
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

type JobQueryClient = Pick<typeof pool, "query">;

async function loadJobs(
  jobId?: string,
  queryClient: JobQueryClient = pool,
): Promise<Job[]> {
  const parameters: string[] = [env.ORGANIZATION_SLUG];
  let jobFilter = "";

  if (jobId) {
    parameters.push(jobId);
    jobFilter = "AND j.id = $2";
  }

  const result = await queryClient.query<JobDatabaseRow>(
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

type ClosureDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  finalPrice: string | null;
  completionDate: Date;
  notes: string | null;
  createdAt: Date;
};

function prepareClosure(
  row: ClosureDatabaseRow,
): Closure {
  return closureSchema.parse({
    id: row.id,
    jobId: row.jobId,
    jobCycleId: row.jobCycleId,
    finalPrice:
      row.finalPrice === null
        ? null
        : Number(row.finalPrice),
    completionDate:
      row.completionDate.toISOString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  });
}

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

type ScopeRevisionDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  revisionNumber: number;
  scopeText: string;
  priceChange: string;
  reason: string | null;
  createdAt: Date;
};

function prepareScopeRevision(
  row: ScopeRevisionDatabaseRow,
): ScopeRevision {
  return scopeRevisionSchema.parse({
    id: row.id,
    jobId: row.jobId,
    jobCycleId: row.jobCycleId,
    revisionNumber: row.revisionNumber,
    scopeText: row.scopeText,
    priceChange: Number(row.priceChange),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  });
}

type VisitDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  status: Visit["status"];
  scheduledStart: Date;
  scheduledEnd: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function prepareVisit(
  row: VisitDatabaseRow,
): Visit {
  return visitSchema.parse({
    id: row.id,
    jobId: row.jobId,
    jobCycleId: row.jobCycleId,
    status: row.status,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd:
      row.scheduledEnd?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

jobsRouter.get(
  "/:jobId/visits",
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

    try {
      const jobResult = await pool.query<{ id: string }>(
        `
          SELECT job.id
          FROM jobs job
          JOIN organizations organization
            ON organization.id = job.organization_id
          WHERE job.id = $1
            AND organization.slug = $2
        `,
        [
          jobIdResult.data,
          env.ORGANIZATION_SLUG,
        ],
      );

      if (!jobResult.rows[0]) {
        response.status(404).json({
          ok: false,
          error: "Job was not found.",
        });
        return;
      }

      const visitResult =
        await pool.query<VisitDatabaseRow>(
          `
            SELECT
              visit.id,
              visit.job_id AS "jobId",
              visit.job_cycle_id AS "jobCycleId",
              visit.status,
              visit.scheduled_start AS "scheduledStart",
              visit.scheduled_end AS "scheduledEnd",
              visit.notes,
              visit.created_at AS "createdAt",
              visit.updated_at AS "updatedAt"
            FROM visits visit
            JOIN organizations organization
              ON organization.id =
                visit.organization_id
            WHERE visit.job_id = $1
              AND organization.slug = $2
            ORDER BY
              visit.scheduled_start ASC,
              visit.created_at ASC
          `,
          [
            jobIdResult.data,
            env.ORGANIZATION_SLUG,
          ],
        );

      response.json({
        ok: true,
        visits: visitResult.rows.map(prepareVisit),
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to load visits.",
      });
    }
  },
);

jobsRouter.post(
  "/:jobId/visits",
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

    const inputResult = createVisitSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid visit.",
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
            "Visits can only be scheduled for an active work cycle.",
        });
        return;
      }

      const visitResult =
        await databaseClient.query<VisitDatabaseRow>(
          `
            INSERT INTO visits (
              organization_id,
              job_id,
              job_cycle_id,
              scheduled_start,
              scheduled_end,
              notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
              id,
              job_id AS "jobId",
              job_cycle_id AS "jobCycleId",
              status,
              scheduled_start AS "scheduledStart",
              scheduled_end AS "scheduledEnd",
              notes,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            inputResult.data.scheduledStart,
            inputResult.data.scheduledEnd,
            inputResult.data.notes,
          ],
        );

      const createdVisit = visitResult.rows[0];

      if (!createdVisit) {
        throw new Error(
          "PostgreSQL did not return the created visit.",
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
            'visit_scheduled',
            jsonb_strip_nulls(
              jsonb_build_object(
                'visitId',
                $4::uuid,
                'scheduledStart',
                $5::timestamptz,
                'scheduledEnd',
                $6::timestamptz
              )
            )
          )
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
          currentCycle.jobCycleId,
          createdVisit.id,
          inputResult.data.scheduledStart,
          inputResult.data.scheduledEnd,
        ],
      );

      await databaseClient.query(
        `
          UPDATE jobs
          SET updated_at = now()
          WHERE organization_id = $1
            AND id = $2
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
        ],
      );

      const visit = prepareVisit(createdVisit);

      await databaseClient.query("COMMIT");

      response.status(201).json({
        ok: true,
        visit,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to schedule visit.",
      });
    } finally {
      databaseClient.release();
    }
  },
);

jobsRouter.patch(
  "/:jobId/visits/:visitId/status",
  async (request, response) => {
    const jobIdResult = idSchema.safeParse(
      request.params.jobId,
    );
    const visitIdResult = idSchema.safeParse(
      request.params.visitId,
    );

    if (!jobIdResult.success || !visitIdResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid Job or Visit ID.",
      });
      return;
    }

    const inputResult = updateVisitStatusSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid Visit status.",
        details: inputResult.error.flatten(),
      });
      return;
    }

    const databaseClient = await pool.connect();

    try {
      await databaseClient.query("BEGIN");

      const existingResult = await databaseClient.query<{
        organizationId: string;
        jobCycleId: string;
        status: Visit["status"];
      }>(
        `
          SELECT
            visit.organization_id AS "organizationId",
            visit.job_cycle_id AS "jobCycleId",
            visit.status
          FROM visits visit
          JOIN organizations organization
            ON organization.id = visit.organization_id
          WHERE visit.id = $1
            AND visit.job_id = $2
            AND organization.slug = $3
          FOR UPDATE OF visit
        `,
        [
          visitIdResult.data,
          jobIdResult.data,
          env.ORGANIZATION_SLUG,
        ],
      );

      const existingVisit = existingResult.rows[0];

      if (!existingVisit) {
        await databaseClient.query("ROLLBACK");

        response.status(404).json({
          ok: false,
          error: "Visit was not found.",
        });
        return;
      }

      if (existingVisit.status !== "scheduled") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Only a scheduled Visit can be completed or cancelled.",
        });
        return;
      }

      const updatedResult =
        await databaseClient.query<VisitDatabaseRow>(
          `
            UPDATE visits
            SET
              status = $4,
              updated_at = now()
            WHERE organization_id = $1
              AND job_id = $2
              AND id = $3
            RETURNING
              id,
              job_id AS "jobId",
              job_cycle_id AS "jobCycleId",
              status,
              scheduled_start AS "scheduledStart",
              scheduled_end AS "scheduledEnd",
              notes,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            existingVisit.organizationId,
            jobIdResult.data,
            visitIdResult.data,
            inputResult.data.status,
          ],
        );

      const updatedVisit = updatedResult.rows[0];

      if (!updatedVisit) {
        throw new Error(
          "PostgreSQL did not return the updated Visit.",
        );
      }

      const eventType =
        inputResult.data.status === "completed"
          ? "visit_completed"
          : "visit_cancelled";

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
            $4,
            jsonb_build_object(
              'visitId',
              $5::uuid,
              'status',
              $6::text
            )
          )
        `,
        [
          existingVisit.organizationId,
          jobIdResult.data,
          existingVisit.jobCycleId,
          eventType,
          visitIdResult.data,
          inputResult.data.status,
        ],
      );

      await databaseClient.query(
        `
          UPDATE jobs
          SET updated_at = now()
          WHERE organization_id = $1
            AND id = $2
        `,
        [
          existingVisit.organizationId,
          jobIdResult.data,
        ],
      );

      const visit = prepareVisit(updatedVisit);

      await databaseClient.query("COMMIT");

      response.json({
        ok: true,
        visit,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to update Visit status.",
      });
    } finally {
      databaseClient.release();
    }
  },
);

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

jobsRouter.post(
  "/:jobId/scope-revisions",
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

    const inputResult = createScopeRevisionSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid scope revision.",
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
          FOR UPDATE OF job, cycle
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
            "Scope revisions can only be added to an active work cycle.",
        });
        return;
      }

      const revisionNumberResult =
        await databaseClient.query<{
          revisionNumber: number;
        }>(
          `
            SELECT
              COALESCE(MAX(revision_number), 0) + 1
                AS "revisionNumber"
            FROM scope_revisions
            WHERE organization_id = $1
              AND job_id = $2
              AND job_cycle_id = $3
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
          ],
        );

      const revisionNumber =
        revisionNumberResult.rows[0]?.revisionNumber;

      if (!revisionNumber) {
        throw new Error(
          "Unable to determine the next scope revision number.",
        );
      }

      const revisionResult =
        await databaseClient.query<ScopeRevisionDatabaseRow>(
          `
            INSERT INTO scope_revisions (
              organization_id,
              job_id,
              job_cycle_id,
              revision_number,
              scope_text,
              price_change,
              reason
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
              id,
              job_id AS "jobId",
              job_cycle_id AS "jobCycleId",
              revision_number AS "revisionNumber",
              scope_text AS "scopeText",
              price_change AS "priceChange",
              reason,
              created_at AS "createdAt"
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            revisionNumber,
            inputResult.data.scopeText,
            inputResult.data.priceChange,
            inputResult.data.reason ?? null,
          ],
        );

      const createdScopeRevision =
        revisionResult.rows[0];

      if (!createdScopeRevision) {
        throw new Error(
          "PostgreSQL did not return the created scope revision.",
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
            'scope_revision_created',
            jsonb_build_object(
              'scopeRevisionId',
              $4::uuid,
              'revisionNumber',
              $5::integer,
              'priceChange',
              $6::numeric
            )
          )
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
          currentCycle.jobCycleId,
          createdScopeRevision.id,
          revisionNumber,
          inputResult.data.priceChange,
        ],
      );

      await databaseClient.query(
        `
          UPDATE jobs
          SET updated_at = now()
          WHERE organization_id = $1
            AND id = $2
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
        ],
      );

      const scopeRevision = prepareScopeRevision(
        createdScopeRevision,
      );

      await databaseClient.query("COMMIT");

      response.status(201).json({
        ok: true,
        scopeRevision,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to create scope revision.",
      });
    } finally {
      databaseClient.release();
    }
  },
);

jobsRouter.post(
  "/:jobId/close-cycle",
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

    const inputResult = closeJobCycleSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid closure details.",
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
        cycleNumber: number;
        stage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            cycle.id AS "jobCycleId",
            cycle.cycle_number AS "cycleNumber",
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
          FOR UPDATE OF cycle
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
          error: "The current work cycle is already closed.",
        });
        return;
      }

      const closureResult =
        await databaseClient.query<ClosureDatabaseRow>(
          `
            INSERT INTO closures (
              organization_id,
              job_id,
              job_cycle_id,
              final_price,
              notes
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
              id,
              job_id AS "jobId",
              job_cycle_id AS "jobCycleId",
              final_price AS "finalPrice",
              completion_date AS "completionDate",
              notes,
              created_at AS "createdAt"
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            inputResult.data.finalPrice,
            inputResult.data.notes,
          ],
        );

      const createdClosure = closureResult.rows[0];

      if (!createdClosure) {
        throw new Error(
          "PostgreSQL did not return the created closure.",
        );
      }

      const updatedCycleResult =
        await databaseClient.query<{ id: string }>(
          `
            UPDATE job_cycles
            SET
              stage = 'completed',
              completed_at = (
                SELECT closure.completion_date
                FROM closures closure
                WHERE closure.organization_id = $1
                  AND closure.job_id = $2
                  AND closure.job_cycle_id = $3
                  AND closure.id = $4
              ),
              updated_at = now()
            WHERE organization_id = $1
              AND job_id = $2
              AND id = $3
              AND stage = 'project'
            RETURNING id
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            createdClosure.id,
          ],
        );

      if (!updatedCycleResult.rows[0]) {
        throw new Error(
          "The active work cycle could not be closed.",
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
            'cycle_closed',
            jsonb_build_object(
              'closureId',
              $4::uuid,
              'cycleNumber',
              $5::integer,
              'finalPrice',
              $6::numeric
            )
          )
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
          currentCycle.jobCycleId,
          createdClosure.id,
          currentCycle.cycleNumber,
          inputResult.data.finalPrice,
        ],
      );

      const jobs = await loadJobs(
        jobIdResult.data,
        databaseClient,
      );
      const updatedJob = jobs[0];

      if (!updatedJob) {
        throw new Error(
          "The closed Job could not be reloaded.",
        );
      }

      await databaseClient.query("COMMIT");

      response.status(201).json({
        ok: true,
        closure: prepareClosure(createdClosure),
        job: updatedJob,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to close the work cycle.",
      });
    } finally {
      databaseClient.release();
    }
  },
);

jobsRouter.post(
  "/:jobId/reopen-cycle",
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

    const inputResult = reopenJobCycleSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid reopen request.",
        details: inputResult.error.flatten(),
      });
      return;
    }

    const databaseClient = await pool.connect();

    try {
      await databaseClient.query("BEGIN");

      const jobResult = await databaseClient.query<{
        organizationId: string;
      }>(
        `
          SELECT
            job.organization_id AS "organizationId"
          FROM jobs job
          JOIN organizations organization
            ON organization.id = job.organization_id
          WHERE job.id = $1
            AND organization.slug = $2
          FOR UPDATE OF job
        `,
        [
          jobIdResult.data,
          env.ORGANIZATION_SLUG,
        ],
      );

      const lockedJob = jobResult.rows[0];

      if (!lockedJob) {
        await databaseClient.query("ROLLBACK");

        response.status(404).json({
          ok: false,
          error: "Job was not found.",
        });
        return;
      }

      const cycleResult = await databaseClient.query<{
        jobCycleId: string;
        cycleNumber: number;
        stage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            cycle.id AS "jobCycleId",
            cycle.cycle_number AS "cycleNumber",
            cycle.stage
          FROM job_cycles cycle
          WHERE cycle.organization_id = $1
            AND cycle.job_id = $2
          ORDER BY cycle.cycle_number DESC
          LIMIT 1
        `,
        [
          lockedJob.organizationId,
          jobIdResult.data,
        ],
      );

      const currentCycle = cycleResult.rows[0];

      if (!currentCycle) {
        throw new Error(
          "The Job does not have a work cycle.",
        );
      }

      if (currentCycle.stage !== "completed") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Only a completed work cycle can be reopened.",
        });
        return;
      }

      const nextCycleNumber =
        currentCycle.cycleNumber + 1;

      const newCycleResult =
        await databaseClient.query<{
          id: string;
        }>(
          `
            INSERT INTO job_cycles (
              organization_id,
              job_id,
              cycle_number,
              reason,
              stage
            )
            VALUES (
              $1,
              $2,
              $3,
              'reopened',
              'project'
            )
            RETURNING id
          `,
          [
            lockedJob.organizationId,
            jobIdResult.data,
            nextCycleNumber,
          ],
        );

      const newCycle = newCycleResult.rows[0];

      if (!newCycle) {
        throw new Error(
          "PostgreSQL did not return the reopened cycle.",
        );
      }

      await databaseClient.query(
        `
          UPDATE jobs
          SET updated_at = now()
          WHERE organization_id = $1
            AND id = $2
        `,
        [
          lockedJob.organizationId,
          jobIdResult.data,
        ],
      );

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
            'cycle_reopened',
            jsonb_build_object(
              'previousCycleId',
              $4::uuid,
              'previousCycleNumber',
              $5::integer,
              'cycleNumber',
              $6::integer
            )
          )
        `,
        [
          lockedJob.organizationId,
          jobIdResult.data,
          newCycle.id,
          currentCycle.jobCycleId,
          currentCycle.cycleNumber,
          nextCycleNumber,
        ],
      );

      const refreshedJobs = await loadJobs(
        jobIdResult.data,
        databaseClient,
      );

      const reopenedJob = refreshedJobs[0];

      if (!reopenedJob) {
        throw new Error(
          "Unable to reload the reopened Job.",
        );
      }

      await databaseClient.query("COMMIT");

      response.status(201).json({
        ok: true,
        job: reopenedJob,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to reopen the work cycle.",
      });
    } finally {
      databaseClient.release();
    }
  },
);
