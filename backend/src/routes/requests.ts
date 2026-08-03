import {
  createRequestSchema,
  idSchema,
  jobSchema,
  requestSchema,
  type Job,
  type Request,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { env } from "../env.js";

export const requestsRouter = Router();

type RequestDatabaseRow = {
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
  status: Request["status"];
  approvedJobId: string | null;
  submittedAt: Date;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreatedJobDatabaseRow = {
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
};

type CreatedJobCycleDatabaseRow = {
  cycleId: string;
  cycleNumber: number;
  cycleReason: Job["currentCycle"]["reason"];
  cycleStage: Job["currentCycle"]["stage"];
  cycleOpenedAt: Date;
  cycleCompletedAt: Date | null;
  cycleCreatedAt: Date;
  cycleUpdatedAt: Date;
};

function prepareCreatedJob(
  job: CreatedJobDatabaseRow,
  cycle: CreatedJobCycleDatabaseRow,
  clientName: string,
): Job {
  return jobSchema.parse({
    id: job.id,
    clientId: job.clientId,
    clientName,
    title: job.title,
    description: job.description,
    serviceAddressLine1: job.serviceAddressLine1,
    serviceAddressLine2: job.serviceAddressLine2,
    serviceCity: job.serviceCity,
    serviceState: job.serviceState,
    servicePostalCode: job.servicePostalCode,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    currentCycle: {
      id: cycle.cycleId,
      cycleNumber: cycle.cycleNumber,
      reason: cycle.cycleReason,
      stage: cycle.cycleStage,
      openedAt: cycle.cycleOpenedAt.toISOString(),
      completedAt: cycle.cycleCompletedAt?.toISOString() ?? null,
      createdAt: cycle.cycleCreatedAt.toISOString(),
      updatedAt: cycle.cycleUpdatedAt.toISOString(),
    },
  });
}

function prepareRequest(row: RequestDatabaseRow): Request {
  return requestSchema.parse({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

requestsRouter.get("/", async (_request, response) => {
  try {
    const result = await pool.query<RequestDatabaseRow>(
      `
        SELECT
          request.id,
          request.client_id AS "clientId",
          client.name AS "clientName",
          request.title,
          request.description,
          request.service_address_line_1 AS "serviceAddressLine1",
          request.service_address_line_2 AS "serviceAddressLine2",
          request.service_city AS "serviceCity",
          request.service_state AS "serviceState",
          request.service_postal_code AS "servicePostalCode",
          request.status,
          request.approved_job_id AS "approvedJobId",
          request.submitted_at AS "submittedAt",
          request.decided_at AS "decidedAt",
          request.created_at AS "createdAt",
          request.updated_at AS "updatedAt"
        FROM requests request
        JOIN clients client
          ON client.organization_id = request.organization_id
         AND client.id = request.client_id
        JOIN organizations organization
          ON organization.id = request.organization_id
        WHERE organization.slug = $1
        ORDER BY
          CASE request.status
            WHEN 'open' THEN 0
            WHEN 'approved' THEN 1
            ELSE 2
          END,
          request.submitted_at DESC
      `,
      [env.ORGANIZATION_SLUG],
    );

    response.json({
      ok: true,
      requests: result.rows.map(prepareRequest),
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to load requests.",
    });
  }
});

requestsRouter.post("/", async (request, response) => {

  const inputResult = createRequestSchema.safeParse(request.body);

  if (!inputResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid request information.",
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
      archivedAt: Date | null;
    }>(
      `
        SELECT
          client.organization_id AS "organizationId",
          client.name AS "clientName",
          client.archived_at AS "archivedAt"
        FROM clients client
        JOIN organizations organization
          ON organization.id = client.organization_id
        WHERE client.id = $1
          AND organization.slug = $2
        FOR SHARE OF client
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

    if (selectedClient.archivedAt) {
      await databaseClient.query("ROLLBACK");

      response.status(409).json({
        ok: false,
        error:
          "Restore this Client before creating a new Request.",
      });
      return;
    }

    const requestResult = await databaseClient.query<
      Omit<RequestDatabaseRow, "clientName">
    >(
      `
        INSERT INTO requests (
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
          status,
          approved_job_id AS "approvedJobId",
          submitted_at AS "submittedAt",
          decided_at AS "decidedAt",
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

    const createdRequest = requestResult.rows[0];

    if (!createdRequest) {
      throw new Error("PostgreSQL did not return the created request.");
    }

    await databaseClient.query(
      `
        INSERT INTO request_events (
          organization_id,
          request_id,
          event_type,
          details
        )
        VALUES (
          $1,
          $2,
          'request_submitted',
          '{}'::jsonb
        )
      `,
      [selectedClient.organizationId, createdRequest.id],
    );

    await databaseClient.query("COMMIT");

    response.status(201).json({
      ok: true,
      request: prepareRequest({
        ...createdRequest,
        clientName: selectedClient.clientName,
      }),
    });
  } catch (error) {
    await databaseClient.query("ROLLBACK");
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to create request.",
    });
  } finally {
    databaseClient.release();
  }
});

requestsRouter.post("/:requestId/approve", async (request, response) => {

  const requestIdResult = idSchema.safeParse(request.params.requestId);

  if (!requestIdResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid request ID.",
    });
    return;
  }

  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const selectedRequestResult = await databaseClient.query<
      RequestDatabaseRow & { organizationId: string }
    >(
      `
        SELECT
          work_request.organization_id AS "organizationId",
          work_request.id,
          work_request.client_id AS "clientId",
          client.name AS "clientName",
          work_request.title,
          work_request.description,
          work_request.service_address_line_1 AS "serviceAddressLine1",
          work_request.service_address_line_2 AS "serviceAddressLine2",
          work_request.service_city AS "serviceCity",
          work_request.service_state AS "serviceState",
          work_request.service_postal_code AS "servicePostalCode",
          work_request.status,
          work_request.approved_job_id AS "approvedJobId",
          work_request.submitted_at AS "submittedAt",
          work_request.decided_at AS "decidedAt",
          work_request.created_at AS "createdAt",
          work_request.updated_at AS "updatedAt"
        FROM requests work_request
        JOIN clients client
          ON client.organization_id = work_request.organization_id
         AND client.id = work_request.client_id
        JOIN organizations organization
          ON organization.id = work_request.organization_id
        WHERE work_request.id = $1
          AND organization.slug = $2
        FOR UPDATE OF work_request
      `,
      [requestIdResult.data, env.ORGANIZATION_SLUG],
    );

    const selectedRequest = selectedRequestResult.rows[0];

    if (!selectedRequest) {
      await databaseClient.query("ROLLBACK");

      response.status(404).json({
        ok: false,
        error: "Request was not found.",
      });
      return;
    }

    if (selectedRequest.status !== "open") {
      await databaseClient.query("ROLLBACK");

      response.status(409).json({
        ok: false,
        error:
          selectedRequest.status === "approved"
            ? "Request has already been approved."
            : "A declined request cannot be approved.",
        approvedJobId: selectedRequest.approvedJobId,
      });
      return;
    }

    const jobResult = await databaseClient.query<CreatedJobDatabaseRow>(
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
        selectedRequest.organizationId,
        selectedRequest.clientId,
        selectedRequest.title,
        selectedRequest.description,
        selectedRequest.serviceAddressLine1,
        selectedRequest.serviceAddressLine2,
        selectedRequest.serviceCity,
        selectedRequest.serviceState,
        selectedRequest.servicePostalCode,
      ],
    );

    const createdJob = jobResult.rows[0];

    if (!createdJob) {
      throw new Error("PostgreSQL did not return the approved Job.");
    }

    const cycleResult =
      await databaseClient.query<CreatedJobCycleDatabaseRow>(
        `
          INSERT INTO job_cycles (
            organization_id,
            job_id,
            cycle_number,
            reason,
            stage
          )
          VALUES ($1, $2, 1, 'original', 'project')
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
        [selectedRequest.organizationId, createdJob.id],
      );

    const createdCycle = cycleResult.rows[0];

    if (!createdCycle) {
      throw new Error("PostgreSQL did not return the approved Job cycle.");
    }

    const approvedRequestResult = await databaseClient.query<
      Omit<RequestDatabaseRow, "clientName">
    >(
      `
        UPDATE requests
        SET
          status = 'approved',
          approved_job_id = $1,
          decided_at = now(),
          updated_at = now()
        WHERE organization_id = $2
          AND id = $3
          AND status = 'open'
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
          status,
          approved_job_id AS "approvedJobId",
          submitted_at AS "submittedAt",
          decided_at AS "decidedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        createdJob.id,
        selectedRequest.organizationId,
        selectedRequest.id,
      ],
    );

    const approvedRequest = approvedRequestResult.rows[0];

    if (!approvedRequest) {
      throw new Error("Request approval update did not return a row.");
    }

    await databaseClient.query(
      `
        INSERT INTO request_events (
          organization_id,
          request_id,
          event_type,
          details
        )
        VALUES (
          $1,
          $2,
          'request_approved',
          jsonb_build_object('jobId', $3::uuid)
        )
      `,
      [
        selectedRequest.organizationId,
        selectedRequest.id,
        createdJob.id,
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
          'request_approved',
          jsonb_build_object('requestId', $4::uuid)
        )
      `,
      [
        selectedRequest.organizationId,
        createdJob.id,
        createdCycle.cycleId,
        selectedRequest.id,
      ],
    );

    await databaseClient.query("COMMIT");

    response.status(201).json({
      ok: true,
      request: prepareRequest({
        ...approvedRequest,
        clientName: selectedRequest.clientName,
      }),
      job: prepareCreatedJob(
        createdJob,
        createdCycle,
        selectedRequest.clientName,
      ),
    });
  } catch (error) {
    await databaseClient.query("ROLLBACK");
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to approve request.",
    });
  } finally {
    databaseClient.release();
  }
});
