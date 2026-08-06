import {
  archiveJobSchema,
  cancelJobSchema,
  closeJobCycleSchema,
  closeJobCycleWarningSchema,
  closureSchema,
  createFieldNoteSchema,
  createScopeRevisionSchema,
  createVisitSchema,
  fieldNoteResponseSchema,
  fieldNoteSchema,
  idSchema,
  jobSchema,
  reopenJobCycleSchema,
  scopeRevisionSchema,
  updateScopeRevisionVisitPlanSchema,
  updateVisitStatusSchema,
  visitResponseSchema,
  visitSchema,
  visitScopeRevisionSchema,
  type Closure,
  type FieldNote,
  type Job,
  type ScopeRevision,
  type ScopeVisitRelationshipType,
  type Visit,
  type VisitScopeRevision,
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
  lifecycleStatus: Job["lifecycleStatus"];
  cancelledAt: Date | null;
  cancellationReason: string | null;
  archivedAt: Date | null;
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
    lifecycleStatus: row.lifecycleStatus,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    archivedAt: row.archivedAt?.toISOString() ?? null,
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
  includeArchived = false,
): Promise<Job[]> {
  const parameters: string[] = [env.ORGANIZATION_SLUG];
  let jobFilter = includeArchived
    ? ""
    : "AND j.archived_at IS NULL";

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
        j.lifecycle_status AS "lifecycleStatus",
        j.cancelled_at AS "cancelledAt",
        j.cancellation_reason AS "cancellationReason",
        j.archived_at AS "archivedAt",
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

jobsRouter.get("/", async (request, response) => {
  const includeArchived =
    request.query.includeArchived === "true";

  try {
    response.json({
      ok: true,
      jobs: await loadJobs(
        undefined,
        pool,
        includeArchived,
      ),
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
  visitRequirement: ScopeRevision["visitRequirement"];
  linkedVisitIds: string[];
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
    visitRequirement: row.visitRequirement,
    linkedVisitIds: row.linkedVisitIds,
    createdAt: row.createdAt.toISOString(),
  });
}

type VisitDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  cycleNumber: number;
  status: Visit["status"];
  scheduledStart: Date;
  scheduledEnd: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VisitScopeRevisionDatabaseRow = {
  visitId: string;
  id: string;
  jobCycleId: string;
  revisionNumber: number;
  scopeText: string;
  priceChange: string;
  reason: string | null;
  visitRequirement: ScopeRevision["visitRequirement"];
  relationshipType: ScopeVisitRelationshipType;
  createdAt: Date;
};

function prepareVisitScopeRevision(
  row: VisitScopeRevisionDatabaseRow,
): VisitScopeRevision {
  return visitScopeRevisionSchema.parse({
    id: row.id,
    jobCycleId: row.jobCycleId,
    revisionNumber: row.revisionNumber,
    scopeText: row.scopeText,
    priceChange: Number(row.priceChange),
    reason: row.reason,
    visitRequirement: row.visitRequirement,
    relationshipType: row.relationshipType,
    createdAt: row.createdAt.toISOString(),
  });
}

function prepareVisit(
  row: VisitDatabaseRow,
  linkedScopeRevisions: VisitScopeRevision[] = [],
): Visit {
  return visitSchema.parse({
    id: row.id,
    jobId: row.jobId,
    jobCycleId: row.jobCycleId,
    cycleNumber: row.cycleNumber,
    status: row.status,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd:
      row.scheduledEnd?.toISOString() ?? null,
    notes: row.notes,
    linkedScopeRevisions,
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
              cycle.cycle_number AS "cycleNumber",
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
            JOIN job_cycles cycle
              ON cycle.organization_id =
                visit.organization_id
             AND cycle.job_id = visit.job_id
             AND cycle.id = visit.job_cycle_id
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

      const linkedRevisionResult =
        await pool.query<VisitScopeRevisionDatabaseRow>(
          `
            SELECT
              link.visit_id AS "visitId",
              revision.id,
              revision.job_cycle_id AS "jobCycleId",
              revision.revision_number AS "revisionNumber",
              revision.scope_text AS "scopeText",
              revision.price_change AS "priceChange",
              revision.reason,
              revision.visit_requirement AS "visitRequirement",
              link.relationship_type AS "relationshipType",
              revision.created_at AS "createdAt"
            FROM scope_revision_visits link
            JOIN scope_revisions revision
              ON revision.organization_id =
                link.organization_id
             AND revision.job_id = link.job_id
             AND revision.job_cycle_id =
                link.job_cycle_id
             AND revision.id =
                link.scope_revision_id
            JOIN organizations organization
              ON organization.id =
                link.organization_id
            WHERE link.job_id = $1
              AND organization.slug = $2
            ORDER BY
              revision.revision_number ASC,
              revision.created_at ASC
          `,
          [
            jobIdResult.data,
            env.ORGANIZATION_SLUG,
          ],
        );

      const revisionsByVisit =
        new Map<string, VisitScopeRevision[]>();

      for (const row of linkedRevisionResult.rows) {
        const linkedRevisions =
          revisionsByVisit.get(row.visitId) ?? [];

        linkedRevisions.push(
          prepareVisitScopeRevision(row),
        );

        revisionsByVisit.set(
          row.visitId,
          linkedRevisions,
        );
      }

      response.json({
        ok: true,
        visits: visitResult.rows.map((visit) =>
          prepareVisit(
            visit,
            revisionsByVisit.get(visit.id) ?? [],
          ),
        ),
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
    let transactionCommitted = false;

    try {
      await databaseClient.query("BEGIN");

      const cycleResult = await databaseClient.query<{
        organizationId: string;
        jobCycleId: string;
        cycleNumber: number;
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
        stage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            cycle.id AS "jobCycleId",
            cycle.cycle_number AS "cycleNumber",
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt",
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

      if (currentCycle.lifecycleStatus !== "active") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Cancelled Jobs cannot be modified.",
        });
        return;
      }

      if (currentCycle.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Archived Jobs cannot be modified.",
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

      createdVisit.cycleNumber =
        currentCycle.cycleNumber;

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
      const responsePayload = visitResponseSchema.parse({
        ok: true,
        visit,
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
          error: "Unable to schedule visit.",
        });
      }
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
    let transactionCommitted = false;

    try {
      await databaseClient.query("BEGIN");

      const existingResult = await databaseClient.query<{
        organizationId: string;
        jobCycleId: string;
        cycleNumber: number;
        status: Visit["status"];
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
        currentCycleId: string;
        currentCycleStage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            visit.organization_id AS "organizationId",
            visit.job_cycle_id AS "jobCycleId",
            cycle.cycle_number AS "cycleNumber",
            visit.status,
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt",
            current_cycle.id AS "currentCycleId",
            current_cycle.stage AS "currentCycleStage"
          FROM visits visit
          JOIN jobs job
            ON job.organization_id = visit.organization_id
           AND job.id = visit.job_id
          JOIN organizations organization
            ON organization.id = visit.organization_id
          JOIN job_cycles cycle
            ON cycle.organization_id =
              visit.organization_id
           AND cycle.job_id = visit.job_id
           AND cycle.id = visit.job_cycle_id
          JOIN job_cycles current_cycle
            ON current_cycle.organization_id =
              job.organization_id
           AND current_cycle.job_id = job.id
           AND current_cycle.cycle_number = (
             SELECT MAX(candidate.cycle_number)
             FROM job_cycles candidate
             WHERE candidate.organization_id =
               job.organization_id
               AND candidate.job_id = job.id
           )
          WHERE visit.id = $1
            AND visit.job_id = $2
            AND organization.slug = $3
          FOR UPDATE OF job, current_cycle, visit
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

      if (existingVisit.lifecycleStatus !== "active") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Cancelled Jobs cannot be modified.",
        });
        return;
      }

      if (existingVisit.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Archived Jobs cannot be modified.",
        });
        return;
      }

      if (existingVisit.currentCycleStage !== "project") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Visit status can only be updated during an active work cycle.",
        });
        return;
      }

      if (
        existingVisit.jobCycleId !==
        existingVisit.currentCycleId
      ) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Only Visits in the current work cycle can be modified.",
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

      updatedVisit.cycleNumber =
        existingVisit.cycleNumber;

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
      const responsePayload = visitResponseSchema.parse({
        ok: true,
        visit,
      });

      await databaseClient.query("COMMIT");
      transactionCommitted = true;

      response.json(responsePayload);
    } catch (error) {
      if (!transactionCommitted) {
        await databaseClient.query("ROLLBACK");
      }

      console.error(error);

      if (!response.headersSent) {
        response.status(500).json({
          ok: false,
          error: "Unable to update Visit status.",
        });
      }
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
    let transactionCommitted = false;

    try {
      await databaseClient.query("BEGIN");

      const cycleResult = await databaseClient.query<{
        organizationId: string;
        jobCycleId: string;
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
        stage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            cycle.id AS "jobCycleId",
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt",
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

      if (currentCycle.lifecycleStatus !== "active") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Cancelled Jobs cannot be modified.",
        });
        return;
      }

      if (currentCycle.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Archived Jobs cannot be modified.",
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

      const responsePayload = fieldNoteResponseSchema.parse({
        ok: true,
        fieldNote: prepareFieldNote(
          createdFieldNote,
        ),
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
          error: "Unable to create field note.",
        });
      }
    } finally {
      databaseClient.release();
    }
  },
);

jobsRouter.get(
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

      const revisionResult =
        await pool.query<ScopeRevisionDatabaseRow>(
          `
            SELECT
              revision.id,
              revision.job_id AS "jobId",
              revision.job_cycle_id AS "jobCycleId",
              revision.revision_number AS "revisionNumber",
              revision.scope_text AS "scopeText",
              revision.price_change AS "priceChange",
              revision.reason,
              revision.visit_requirement AS "visitRequirement",
              COALESCE(
                array_agg(
                  link.visit_id
                  ORDER BY link.created_at ASC
                ) FILTER (
                  WHERE link.visit_id IS NOT NULL
                ),
                ARRAY[]::uuid[]
              ) AS "linkedVisitIds",
              revision.created_at AS "createdAt"
            FROM scope_revisions revision
            JOIN organizations organization
              ON organization.id =
                revision.organization_id
            JOIN job_cycles cycle
              ON cycle.organization_id =
                revision.organization_id
             AND cycle.job_id = revision.job_id
             AND cycle.id = revision.job_cycle_id
            LEFT JOIN scope_revision_visits link
              ON link.organization_id =
                revision.organization_id
             AND link.job_id = revision.job_id
             AND link.job_cycle_id =
                revision.job_cycle_id
             AND link.scope_revision_id =
                revision.id
            WHERE revision.job_id = $1
              AND organization.slug = $2
            GROUP BY
              revision.id,
              cycle.cycle_number
            ORDER BY
              cycle.cycle_number ASC,
              revision.revision_number ASC
          `,
          [
            jobIdResult.data,
            env.ORGANIZATION_SLUG,
          ],
        );

      response.json({
        ok: true,
        scopeRevisions: revisionResult.rows.map(
          prepareScopeRevision,
        ),
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to load scope revisions.",
      });
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
        cycleNumber: number;
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
        stage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            cycle.id AS "jobCycleId",
            cycle.cycle_number AS "cycleNumber",
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt",
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

      if (currentCycle.lifecycleStatus !== "active") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error: "Cancelled Jobs cannot be modified.",
        });
        return;
      }

      if (currentCycle.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error: "Archived Jobs cannot be modified.",
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

      const visitPlan = inputResult.data.visitPlan;
      const visitRequirement: ScopeRevision["visitRequirement"] =
        visitPlan.mode === "undecided"
          ? "undecided"
          : visitPlan.mode === "not_required"
            ? "not_required"
            : visitPlan.mode === "existing" &&
                visitPlan.relationshipType ===
                  "discovered_during"
              ? "undecided"
              : "required";
      const relationshipType:
        | ScopeVisitRelationshipType
        | null =
        visitPlan.mode === "new"
          ? "planned_for"
          : visitPlan.mode === "existing"
            ? visitPlan.relationshipType
            : null;

      let linkedVisitRow: VisitDatabaseRow | null = null;

      if (visitPlan.mode === "existing") {
        const existingVisitResult =
          await databaseClient.query<VisitDatabaseRow>(
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
              WHERE visit.organization_id = $1
                AND visit.job_id = $2
                AND visit.job_cycle_id = $3
                AND visit.id = $4
              FOR SHARE OF visit
            `,
            [
              currentCycle.organizationId,
              jobIdResult.data,
              currentCycle.jobCycleId,
              visitPlan.visitId,
            ],
          );

        linkedVisitRow =
          existingVisitResult.rows[0] ?? null;

        if (!linkedVisitRow) {
          await databaseClient.query("ROLLBACK");

          response.status(409).json({
            ok: false,
            error:
              "The selected Visit is not available in the active work cycle.",
          });
          return;
        }

        if (
          visitPlan.relationshipType === "planned_for" &&
          linkedVisitRow.status !== "scheduled"
        ) {
          await databaseClient.query("ROLLBACK");

          response.status(409).json({
            ok: false,
            error:
              "Only a scheduled Visit can be used for planned work.",
          });
          return;
        }

        if (
          visitPlan.relationshipType ===
            "discovered_during" &&
          linkedVisitRow.status !== "completed"
        ) {
          await databaseClient.query("ROLLBACK");

          response.status(409).json({
            ok: false,
            error:
              "Only a completed Visit can be used as where the scope change was discovered.",
          });
          return;
        }
      }

      if (visitPlan.mode === "new") {
        const newVisitResult =
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
              visitPlan.visit.scheduledStart,
              visitPlan.visit.scheduledEnd,
              visitPlan.visit.notes,
            ],
          );

        linkedVisitRow = newVisitResult.rows[0] ?? null;

        if (!linkedVisitRow) {
          throw new Error(
            "PostgreSQL did not return the newly scheduled Visit.",
          );
        }
      }

      if (linkedVisitRow) {
        linkedVisitRow.cycleNumber =
          currentCycle.cycleNumber;
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
              reason,
              visit_requirement
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
              id,
              job_id AS "jobId",
              job_cycle_id AS "jobCycleId",
              revision_number AS "revisionNumber",
              scope_text AS "scopeText",
              price_change AS "priceChange",
              reason,
              visit_requirement AS "visitRequirement",
              ARRAY[]::uuid[] AS "linkedVisitIds",
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
            visitRequirement,
          ],
        );

      const createdScopeRevision =
        revisionResult.rows[0];

      if (!createdScopeRevision) {
        throw new Error(
          "PostgreSQL did not return the created scope revision.",
        );
      }

      if (linkedVisitRow) {
        if (!relationshipType) {
          throw new Error(
            "A linked Visit requires a relationship type.",
          );
        }

        await databaseClient.query(
          `
            INSERT INTO scope_revision_visits (
              organization_id,
              job_id,
              job_cycle_id,
              scope_revision_id,
              visit_id,
              relationship_type
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            createdScopeRevision.id,
            linkedVisitRow.id,
            relationshipType,
          ],
        );

        createdScopeRevision.linkedVisitIds = [
          linkedVisitRow.id,
        ];

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
              'scope_revision_visit_linked',
              jsonb_build_object(
                'scopeRevisionId',
                $4::uuid,
                'visitId',
                $5::uuid,
                'visitSource',
                $6::text,
                'relationshipType',
                $7::text
              )
            )
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            createdScopeRevision.id,
            linkedVisitRow.id,
            visitPlan.mode,
            relationshipType,
          ],
        );
      }

      if (visitPlan.mode === "new" && linkedVisitRow) {
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
              jsonb_build_object(
                'visitId',
                $4::uuid,
                'scheduledStart',
                $5::timestamptz,
                'scopeRevisionId',
                $6::uuid
              )
            )
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            linkedVisitRow.id,
            linkedVisitRow.scheduledStart,
            createdScopeRevision.id,
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
            'scope_revision_created',
            jsonb_strip_nulls(
              jsonb_build_object(
                'scopeRevisionId',
                $4::uuid,
                'revisionNumber',
                $5::integer,
                'priceChange',
                $6::numeric,
                'visitRequirement',
                $7::text,
                'linkedVisitId',
                $8::uuid
              )
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
          visitRequirement,
          linkedVisitRow?.id ?? null,
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
      const visit = linkedVisitRow
        ? prepareVisit(linkedVisitRow)
        : null;

      await databaseClient.query("COMMIT");

      response.status(201).json({
        ok: true,
        scopeRevision,
        visit,
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

jobsRouter.patch(
  "/:jobId/scope-revisions/:scopeRevisionId/visit-plan",
  async (request, response) => {
    const jobIdResult = idSchema.safeParse(
      request.params.jobId,
    );
    const scopeRevisionIdResult = idSchema.safeParse(
      request.params.scopeRevisionId,
    );

    if (
      !jobIdResult.success ||
      !scopeRevisionIdResult.success
    ) {
      response.status(400).json({
        ok: false,
        error: "Invalid Job or Scope Revision ID.",
      });
      return;
    }

    const inputResult =
      updateScopeRevisionVisitPlanSchema.safeParse(
        request.body,
      );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid Scope Revision Visit decision.",
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
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
        stage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            cycle.id AS "jobCycleId",
            cycle.cycle_number AS "cycleNumber",
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt",
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

      if (currentCycle.lifecycleStatus !== "active") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Cancelled Jobs cannot be modified.",
        });
        return;
      }

      if (currentCycle.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Archived Jobs cannot be modified.",
        });
        return;
      }

      if (currentCycle.stage !== "project") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Scope Revision Visit decisions can only be changed during an active work cycle.",
        });
        return;
      }

      const revisionResult =
        await databaseClient.query<ScopeRevisionDatabaseRow>(
          `
            SELECT
              revision.id,
              revision.job_id AS "jobId",
              revision.job_cycle_id AS "jobCycleId",
              revision.revision_number AS "revisionNumber",
              revision.scope_text AS "scopeText",
              revision.price_change AS "priceChange",
              revision.reason,
              revision.visit_requirement AS "visitRequirement",
              ARRAY(
                SELECT link.visit_id
                FROM scope_revision_visits link
                WHERE link.organization_id =
                    revision.organization_id
                  AND link.job_id = revision.job_id
                  AND link.job_cycle_id =
                    revision.job_cycle_id
                  AND link.scope_revision_id =
                    revision.id
                ORDER BY link.created_at ASC
              ) AS "linkedVisitIds",
              revision.created_at AS "createdAt"
            FROM scope_revisions revision
            WHERE revision.organization_id = $1
              AND revision.job_id = $2
              AND revision.job_cycle_id = $3
              AND revision.id = $4
            FOR UPDATE OF revision
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            scopeRevisionIdResult.data,
          ],
        );

      const scopeRevision = revisionResult.rows[0];

      if (!scopeRevision) {
        await databaseClient.query("ROLLBACK");

        response.status(404).json({
          ok: false,
          error:
            "Scope Revision was not found in the active work cycle.",
        });
        return;
      }

      if (scopeRevision.visitRequirement !== "undecided") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "This Scope Revision already has a Visit decision.",
        });
        return;
      }

      const visitPlan = inputResult.data.visitPlan;
      const visitRequirement:
        ScopeRevision["visitRequirement"] =
          visitPlan.mode === "not_required"
            ? "not_required"
            : "required";

      let linkedVisitRow: VisitDatabaseRow | null = null;

      if (visitPlan.mode === "existing") {
        const visitResult =
          await databaseClient.query<VisitDatabaseRow>(
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
              WHERE visit.organization_id = $1
                AND visit.job_id = $2
                AND visit.job_cycle_id = $3
                AND visit.id = $4
                AND visit.status = 'scheduled'
              FOR SHARE OF visit
            `,
            [
              currentCycle.organizationId,
              jobIdResult.data,
              currentCycle.jobCycleId,
              visitPlan.visitId,
            ],
          );

        linkedVisitRow = visitResult.rows[0] ?? null;

        if (!linkedVisitRow) {
          await databaseClient.query("ROLLBACK");

          response.status(409).json({
            ok: false,
            error:
              "The selected scheduled Visit is not available in the active work cycle.",
          });
          return;
        }
      }

      if (visitPlan.mode === "new") {
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
              visitPlan.visit.scheduledStart,
              visitPlan.visit.scheduledEnd,
              visitPlan.visit.notes,
            ],
          );

        linkedVisitRow = visitResult.rows[0] ?? null;

        if (!linkedVisitRow) {
          throw new Error(
            "PostgreSQL did not return the newly scheduled Visit.",
          );
        }
      }

      if (linkedVisitRow) {
        linkedVisitRow.cycleNumber =
          currentCycle.cycleNumber;

        await databaseClient.query(
          `
            INSERT INTO scope_revision_visits (
              organization_id,
              job_id,
              job_cycle_id,
              scope_revision_id,
              visit_id,
              relationship_type
            )
            VALUES ($1, $2, $3, $4, $5, 'planned_for')
            ON CONFLICT (
              scope_revision_id,
              visit_id
            ) DO NOTHING
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            scopeRevision.id,
            linkedVisitRow.id,
          ],
        );

        scopeRevision.linkedVisitIds = [
          ...new Set([
            ...scopeRevision.linkedVisitIds,
            linkedVisitRow.id,
          ]),
        ];

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
              'scope_revision_visit_linked',
              jsonb_build_object(
                'scopeRevisionId',
                $4::uuid,
                'visitId',
                $5::uuid,
                'visitSource',
                $6::text,
                'relationshipType',
                'planned_for'
              )
            )
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            scopeRevision.id,
            linkedVisitRow.id,
            visitPlan.mode,
          ],
        );
      }

      if (visitPlan.mode === "new" && linkedVisitRow) {
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
              jsonb_build_object(
                'visitId',
                $4::uuid,
                'scheduledStart',
                $5::timestamptz,
                'scopeRevisionId',
                $6::uuid
              )
            )
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            linkedVisitRow.id,
            linkedVisitRow.scheduledStart,
            scopeRevision.id,
          ],
        );
      }

      await databaseClient.query(
        `
          UPDATE scope_revisions
          SET visit_requirement = $5
          WHERE organization_id = $1
            AND job_id = $2
            AND job_cycle_id = $3
            AND id = $4
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
          currentCycle.jobCycleId,
          scopeRevision.id,
          visitRequirement,
        ],
      );

      scopeRevision.visitRequirement = visitRequirement;

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
            'scope_revision_visit_plan_resolved',
            jsonb_strip_nulls(
              jsonb_build_object(
                'scopeRevisionId',
                $4::uuid,
                'previousVisitRequirement',
                'undecided',
                'visitRequirement',
                $5::text,
                'linkedVisitId',
                $6::uuid
              )
            )
          )
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
          currentCycle.jobCycleId,
          scopeRevision.id,
          visitRequirement,
          linkedVisitRow?.id ?? null,
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

      await databaseClient.query("COMMIT");

      response.json({
        ok: true,
        scopeRevision: prepareScopeRevision(scopeRevision),
        visit: linkedVisitRow
          ? prepareVisit(linkedVisitRow)
          : null,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error:
          "Unable to update the Scope Revision Visit decision.",
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
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
        stage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            cycle.id AS "jobCycleId",
            cycle.cycle_number AS "cycleNumber",
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt",
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

      if (currentCycle.lifecycleStatus !== "active") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Cancelled Jobs cannot be modified.",
        });
        return;
      }

      if (currentCycle.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Archived Jobs cannot be modified.",
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

      const warningResult = await databaseClient.query<{
        code:
          | "visit_decision_undecided"
          | "required_visit_missing"
          | "required_visit_incomplete";
        revisionNumber: number;
        scopeText: string;
      }>(
        `
          SELECT
            CASE
              WHEN revision.visit_requirement = 'undecided'
                THEN 'visit_decision_undecided'
              WHEN NOT EXISTS (
                SELECT 1
                FROM scope_revision_visits link
                WHERE link.organization_id =
                    revision.organization_id
                  AND link.job_id = revision.job_id
                  AND link.job_cycle_id =
                    revision.job_cycle_id
                  AND link.scope_revision_id =
                    revision.id
                  AND link.relationship_type =
                    'planned_for'
              )
                THEN 'required_visit_missing'
              ELSE 'required_visit_incomplete'
            END AS code,
            revision.revision_number AS "revisionNumber",
            revision.scope_text AS "scopeText"
          FROM scope_revisions revision
          WHERE revision.organization_id = $1
            AND revision.job_id = $2
            AND revision.job_cycle_id = $3
            AND (
              revision.visit_requirement = 'undecided'
              OR (
                revision.visit_requirement = 'required'
                AND NOT EXISTS (
                  SELECT 1
                  FROM scope_revision_visits link
                  JOIN visits visit
                    ON visit.organization_id =
                        link.organization_id
                   AND visit.job_id = link.job_id
                   AND visit.job_cycle_id =
                        link.job_cycle_id
                   AND visit.id = link.visit_id
                  WHERE link.organization_id =
                      revision.organization_id
                    AND link.job_id = revision.job_id
                    AND link.job_cycle_id =
                      revision.job_cycle_id
                    AND link.scope_revision_id =
                      revision.id
                    AND link.relationship_type =
                      'planned_for'
                    AND visit.status = 'completed'
                )
              )
            )
          ORDER BY revision.revision_number ASC
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
          currentCycle.jobCycleId,
        ],
      );

      const warnings = warningResult.rows.map((warning) =>
        closeJobCycleWarningSchema.parse(warning),
      );

      if (
        warnings.length > 0 &&
        !inputResult.data.confirmScopeVisitWarnings
      ) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "This work cycle has unresolved Scope Revision and Visit items.",
          warnings,
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
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt"
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

      if (lockedJob.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Unarchive this Job before reopening its work cycle.",
        });
        return;
      }

      if (lockedJob.lifecycleStatus !== "active") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error: "A cancelled Job cannot be reopened.",
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

jobsRouter.post(
  "/:jobId/cancel",
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

    const inputResult = cancelJobSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid cancellation request.",
        details: inputResult.error.flatten(),
      });
      return;
    }

    const databaseClient = await pool.connect();

    try {
      await databaseClient.query("BEGIN");

      const jobResult = await databaseClient.query<{
        organizationId: string;
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
        jobCycleId: string;
        cycleStage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt",
            cycle.id AS "jobCycleId",
            cycle.stage AS "cycleStage"
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
          FOR UPDATE OF job, cycle
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

      if (lockedJob.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "An archived Job cannot be cancelled. Unarchive it first.",
        });
        return;
      }

      if (lockedJob.lifecycleStatus === "cancelled") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error: "This Job is already cancelled.",
        });
        return;
      }

      if (lockedJob.cycleStage === "completed") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "A completed Job cannot be cancelled. Archive it instead.",
        });
        return;
      }

      const cancelledVisitsResult =
        await databaseClient.query<{
          cancelledVisitCount: number;
        }>(
          `
            WITH cancelled_visits AS (
              UPDATE visits
              SET
                status = 'cancelled',
                updated_at = now()
              WHERE organization_id = $1
                AND job_id = $2
                AND status = 'scheduled'
              RETURNING id
            )
            SELECT
              COUNT(*)::integer AS "cancelledVisitCount"
            FROM cancelled_visits
          `,
          [
            lockedJob.organizationId,
            jobIdResult.data,
          ],
        );

      const cancelledVisitCount =
        cancelledVisitsResult.rows[0]
          ?.cancelledVisitCount ?? 0;

      await databaseClient.query(
        `
          UPDATE jobs
          SET
            lifecycle_status = 'cancelled',
            cancelled_at = now(),
            cancellation_reason = $3,
            updated_at = now()
          WHERE organization_id = $1
            AND id = $2
        `,
        [
          lockedJob.organizationId,
          jobIdResult.data,
          inputResult.data.reason,
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
            'job_cancelled',
            jsonb_build_object(
              'reason',
              $4::text,
              'cancelledScheduledVisits',
              $5::integer
            )
          )
        `,
        [
          lockedJob.organizationId,
          jobIdResult.data,
          lockedJob.jobCycleId,
          inputResult.data.reason,
          cancelledVisitCount,
        ],
      );

      const refreshedJobs = await loadJobs(
        jobIdResult.data,
        databaseClient,
      );

      const cancelledJob = refreshedJobs[0];

      if (!cancelledJob) {
        throw new Error(
          "Unable to reload the cancelled Job.",
        );
      }

      await databaseClient.query("COMMIT");

      response.json({
        ok: true,
        job: cancelledJob,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to cancel the Job.",
      });
    } finally {
      databaseClient.release();
    }
  },
);

jobsRouter.post(
  "/:jobId/archive",
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

    const inputResult = archiveJobSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid archive request.",
        details: inputResult.error.flatten(),
      });
      return;
    }

    const databaseClient = await pool.connect();

    try {
      await databaseClient.query("BEGIN");

      const jobResult = await databaseClient.query<{
        organizationId: string;
        lifecycleStatus: Job["lifecycleStatus"];
        archivedAt: Date | null;
        jobCycleId: string;
        cycleStage: Job["currentCycle"]["stage"];
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            job.lifecycle_status AS "lifecycleStatus",
            job.archived_at AS "archivedAt",
            cycle.id AS "jobCycleId",
            cycle.stage AS "cycleStage"
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
          FOR UPDATE OF job, cycle
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

      if (lockedJob.archivedAt !== null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error: "This Job is already archived.",
        });
        return;
      }

      const canArchive =
        lockedJob.lifecycleStatus === "cancelled" ||
        lockedJob.cycleStage === "completed";

      if (!canArchive) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Only completed or cancelled Jobs can be archived.",
        });
        return;
      }

      await databaseClient.query(
        `
          UPDATE jobs
          SET
            archived_at = now(),
            updated_at = now()
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
            'job_archived',
            '{}'::jsonb
          )
        `,
        [
          lockedJob.organizationId,
          jobIdResult.data,
          lockedJob.jobCycleId,
        ],
      );

      const refreshedJobs = await loadJobs(
        jobIdResult.data,
        databaseClient,
      );

      const archivedJob = refreshedJobs[0];

      if (!archivedJob) {
        throw new Error(
          "Unable to reload the archived Job.",
        );
      }

      await databaseClient.query("COMMIT");

      response.json({
        ok: true,
        job: archivedJob,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to archive the Job.",
      });
    } finally {
      databaseClient.release();
    }
  },
);

jobsRouter.post(
  "/:jobId/unarchive",
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

    const inputResult = archiveJobSchema.safeParse(
      request.body,
    );

    if (!inputResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid unarchive request.",
        details: inputResult.error.flatten(),
      });
      return;
    }

    const databaseClient = await pool.connect();

    try {
      await databaseClient.query("BEGIN");

      const jobResult = await databaseClient.query<{
        organizationId: string;
        archivedAt: Date | null;
        jobCycleId: string;
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            job.archived_at AS "archivedAt",
            cycle.id AS "jobCycleId"
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
          FOR UPDATE OF job, cycle
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

      if (lockedJob.archivedAt === null) {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error: "This Job is not archived.",
        });
        return;
      }

      await databaseClient.query(
        `
          UPDATE jobs
          SET
            archived_at = NULL,
            updated_at = now()
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
            'job_unarchived',
            '{}'::jsonb
          )
        `,
        [
          lockedJob.organizationId,
          jobIdResult.data,
          lockedJob.jobCycleId,
        ],
      );

      const refreshedJobs = await loadJobs(
        jobIdResult.data,
        databaseClient,
      );

      const unarchivedJob = refreshedJobs[0];

      if (!unarchivedJob) {
        throw new Error(
          "Unable to reload the unarchived Job.",
        );
      }

      await databaseClient.query("COMMIT");

      response.json({
        ok: true,
        job: unarchivedJob,
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to unarchive the Job.",
      });
    } finally {
      databaseClient.release();
    }
  },
);
