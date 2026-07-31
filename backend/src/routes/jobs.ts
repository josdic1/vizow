import {
  createJobSchema,
  jobSchema,
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

jobsRouter.get("/", async (_request, response) => {
  try {
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
        ORDER BY j.updated_at DESC, j.created_at DESC
      `,
      [env.ORGANIZATION_SLUG],
    );

    response.json({
      ok: true,
      jobs: result.rows.map(prepareJob),
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to load jobs.",
    });
  }
});

jobsRouter.post("/", async (request, response) => {
  const inputResult = createJobSchema.safeParse(request.body);

  if (!inputResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid job information.",
      details: inputResult.error.flatten(),
    });
    return;
  }

  const input = inputResult.data;
  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const clientResult = await databaseClient.query<{
      organizationId: string;
      clientName: string;
    }>(
      `
        SELECT
          client.organization_id AS "organizationId",
          client.name AS "clientName"
        FROM clients client
        JOIN organizations organization
          ON organization.id = client.organization_id
        WHERE client.id = $1
          AND organization.slug = $2
      `,
      [input.clientId, env.ORGANIZATION_SLUG],
    );

    const selectedClient = clientResult.rows[0];

    if (!selectedClient) {
      await databaseClient.query("ROLLBACK");

      response.status(404).json({
        ok: false,
        error: "Client was not found.",
      });
      return;
    }

    const jobResult = await databaseClient.query<{
      id: string;
      clientId: string;
      title: string;
      description: string | null;
      serviceAddressLine1: string | null;
      serviceAddressLine2: string | null;
      serviceCity: string | null;
      serviceState: string | null;
      servicePostalCode: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `
        INSERT INTO jobs (
          organization_id,
          client_id,
          title,
          description,
          service_address_line_1,
          service_address_line_2,
          service_city,
          service_state,
          service_postal_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          client_id AS "clientId",
          title,
          description,
          service_address_line_1 AS "serviceAddressLine1",
          service_address_line_2 AS "serviceAddressLine2",
          service_city AS "serviceCity",
          service_state AS "serviceState",
          service_postal_code AS "servicePostalCode",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        selectedClient.organizationId,
        input.clientId,
        input.title,
        input.description,
        input.serviceAddressLine1,
        input.serviceAddressLine2,
        input.serviceCity,
        input.serviceState,
        input.servicePostalCode,
      ],
    );

    const createdJob = jobResult.rows[0];

    if (!createdJob) {
      throw new Error("PostgreSQL did not return the created job.");
    }

    const cycleResult = await databaseClient.query<{
      cycleId: string;
      cycleNumber: number;
      cycleReason: Job["currentCycle"]["reason"];
      cycleStage: Job["currentCycle"]["stage"];
      cycleOpenedAt: Date;
      cycleCompletedAt: Date | null;
      cycleCreatedAt: Date;
      cycleUpdatedAt: Date;
    }>(
      `
        INSERT INTO job_cycles (
          organization_id,
          job_id,
          cycle_number,
          reason
        )
        VALUES ($1, $2, 1, 'original')
        RETURNING
          id AS "cycleId",
          cycle_number AS "cycleNumber",
          reason AS "cycleReason",
          stage AS "cycleStage",
          opened_at AS "cycleOpenedAt",
          completed_at AS "cycleCompletedAt",
          created_at AS "cycleCreatedAt",
          updated_at AS "cycleUpdatedAt"
      `,
      [selectedClient.organizationId, createdJob.id],
    );

    const createdCycle = cycleResult.rows[0];

    if (!createdCycle) {
      throw new Error("PostgreSQL did not return the created job cycle.");
    }

    await databaseClient.query("COMMIT");

    response.status(201).json({
      ok: true,
      job: prepareJob({
        ...createdJob,
        clientName: selectedClient.clientName,
        ...createdCycle,
      }),
    });
  } catch (error) {
    await databaseClient.query("ROLLBACK");
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to create job.",
    });
  } finally {
    databaseClient.release();
  }
});
