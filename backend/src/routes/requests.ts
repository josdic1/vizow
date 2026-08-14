import {
  approveRequestResponseSchema,
  createRequestSchema,
  declineRequestResponseSchema,
  declineRequestSchema,
  idSchema,
  jobSchema,
  requestSchema,
  reviewRequestSchema,
  type Job,
  type Request,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { env } from "../env.js";

export const requestsRouter = Router();

type RequestDatabaseRow = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  title: string;
  description: string | null;
  serviceAddressLine1: string | null;
  serviceAddressLine2: string | null;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostalCode: string | null;
  status: Request["status"];
  approvedJobId: string | null;
  declineReason: string | null;
  submittedAt: Date;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  submittedName?: string | null;
  submittedEmail?: string | null;
  submittedPhone?: string | null;
  preferredTiming?: string | null;
  preferredContact?: string | null;
  suggestedClientId?: string | null;
  suggestedClientName?: string | null;
  matchReason?: string | null;
  media?: Array<{
    id: string;
    url: string;
    originalFilename: string | null;
    createdAt: string;
  }>;
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
  lifecycleStatus: Job["lifecycleStatus"];
  cancelledAt: Date | null;
  cancellationReason: string | null;
  archivedAt: Date | null;
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
    lifecycleStatus: job.lifecycleStatus,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    cancellationReason: job.cancellationReason,
    archivedAt: job.archivedAt?.toISOString() ?? null,
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
    submittedName: row.submittedName ?? null,
    submittedEmail: row.submittedEmail ?? null,
    submittedPhone: row.submittedPhone ?? null,
    preferredTiming: row.preferredTiming ?? null,
    preferredContact: row.preferredContact ?? null,
    suggestedClientId: row.suggestedClientId ?? null,
    suggestedClientName: row.suggestedClientName ?? null,
    matchReason: row.matchReason ?? null,
    media: (row.media ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt).toISOString(),
    })),
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
          request.decline_reason AS "declineReason",
          request.submitted_name AS "submittedName",
          request.submitted_email AS "submittedEmail",
          request.submitted_phone AS "submittedPhone",
          request.preferred_timing AS "preferredTiming",
          request.preferred_contact AS "preferredContact",
          suggestion.id AS "suggestedClientId",
          suggestion.name AS "suggestedClientName",
          suggestion.reason AS "matchReason",
          COALESCE(request_photos.items, '[]'::jsonb) AS media,
          request.submitted_at AS "submittedAt",
          request.decided_at AS "decidedAt",
          request.created_at AS "createdAt",
          request.updated_at AS "updatedAt"
        FROM requests request
        LEFT JOIN clients client
          ON client.organization_id = request.organization_id
         AND client.id = request.client_id
        LEFT JOIN LATERAL (
          SELECT
            candidate.id,
            candidate.name,
            CASE
              WHEN request.submitted_email IS NOT NULL
               AND candidate.email IS NOT NULL
               AND lower(candidate.email) = lower(request.submitted_email)
                THEN 'Same email address'
              WHEN request.submitted_phone IS NOT NULL
               AND candidate.phone IS NOT NULL
               AND regexp_replace(candidate.phone, '[^0-9]', '', 'g') =
                   regexp_replace(request.submitted_phone, '[^0-9]', '', 'g')
                THEN 'Same phone number'
              ELSE 'Same service address'
            END AS reason
          FROM clients candidate
          LEFT JOIN client_addresses candidate_address
            ON candidate_address.organization_id = candidate.organization_id
           AND candidate_address.client_id = candidate.id
           AND candidate_address.archived_at IS NULL
          WHERE candidate.organization_id = request.organization_id
            AND candidate.archived_at IS NULL
            AND (
              (
                request.submitted_email IS NOT NULL
                AND candidate.email IS NOT NULL
                AND lower(candidate.email) = lower(request.submitted_email)
              ) OR (
                request.submitted_phone IS NOT NULL
                AND candidate.phone IS NOT NULL
                AND regexp_replace(candidate.phone, '[^0-9]', '', 'g') =
                    regexp_replace(request.submitted_phone, '[^0-9]', '', 'g')
              ) OR (
                request.service_address_line_1 IS NOT NULL
                AND candidate_address.address_line_1 ILIKE request.service_address_line_1
                AND candidate_address.postal_code ILIKE COALESCE(request.service_postal_code, candidate_address.postal_code)
              )
            )
          ORDER BY
            CASE
              WHEN request.submitted_email IS NOT NULL
               AND lower(candidate.email) = lower(request.submitted_email) THEN 0
              WHEN request.submitted_phone IS NOT NULL
               AND regexp_replace(candidate.phone, '[^0-9]', '', 'g') =
                   regexp_replace(request.submitted_phone, '[^0-9]', '', 'g') THEN 1
              ELSE 2
            END
          LIMIT 1
        ) suggestion ON request.client_id IS NULL
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', media.id,
              'url', media.url,
              'originalFilename', media.original_filename,
              'createdAt', media.created_at
            ) ORDER BY request_media.created_at, media.id
          ) AS items
          FROM request_media
          JOIN media
            ON media.organization_id = request_media.organization_id
           AND media.id = request_media.media_id
          WHERE request_media.organization_id = request.organization_id
            AND request_media.request_id = request.id
        ) request_photos ON true
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
          decline_reason AS "declineReason",
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

requestsRouter.patch("/:requestId/review", async (request, response) => {
  const requestIdResult = idSchema.safeParse(request.params.requestId);
  const inputResult = reviewRequestSchema.safeParse(request.body);

  if (!requestIdResult.success || !inputResult.success) {
    response.status(400).json({
      ok: false,
      error: "Valid Client and approved Request details are required.",
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
        JOIN organizations organization ON organization.id = client.organization_id
        WHERE organization.slug = $1 AND client.id = $2
        FOR SHARE OF client
      `,
      [env.ORGANIZATION_SLUG, input.clientId],
    );
    const selectedClient = clientResult.rows[0];

    if (!selectedClient || selectedClient.archivedAt) {
      await databaseClient.query("ROLLBACK");
      response.status(selectedClient ? 409 : 404).json({
        ok: false,
        error: selectedClient
          ? "Restore this Client before approving the Request."
          : "Client was not found.",
      });
      return;
    }

    const updateResult = await databaseClient.query<RequestDatabaseRow>(
      `
        UPDATE requests
        SET
          client_id = $3,
          title = $4,
          description = $5,
          service_address_line_1 = $6,
          service_address_line_2 = $7,
          service_city = $8,
          service_state = $9,
          service_postal_code = $10,
          updated_at = now()
        WHERE organization_id = $1
          AND id = $2
          AND status = 'open'
        RETURNING
          id,
          client_id AS "clientId",
          $11::text AS "clientName",
          title,
          description,
          service_address_line_1 AS "serviceAddressLine1",
          service_address_line_2 AS "serviceAddressLine2",
          service_city AS "serviceCity",
          service_state AS "serviceState",
          service_postal_code AS "servicePostalCode",
          status,
          approved_job_id AS "approvedJobId",
          decline_reason AS "declineReason",
          submitted_name AS "submittedName",
          submitted_email AS "submittedEmail",
          submitted_phone AS "submittedPhone",
          preferred_timing AS "preferredTiming",
          preferred_contact AS "preferredContact",
          submitted_at AS "submittedAt",
          decided_at AS "decidedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        selectedClient.organizationId,
        requestIdResult.data,
        input.clientId,
        input.title,
        input.description,
        input.serviceAddressLine1,
        input.serviceAddressLine2,
        input.serviceCity,
        input.serviceState,
        input.servicePostalCode,
        selectedClient.clientName,
      ],
    );
    const reviewedRequest = updateResult.rows[0];

    if (!reviewedRequest) {
      await databaseClient.query("ROLLBACK");
      response.status(409).json({
        ok: false,
        error: "Only an open Request can be reviewed.",
      });
      return;
    }

    await databaseClient.query(
      `
        INSERT INTO request_events (organization_id, request_id, event_type, details)
        VALUES ($1, $2, 'request_reviewed', jsonb_build_object('clientId', $3::uuid))
      `,
      [selectedClient.organizationId, reviewedRequest.id, input.clientId],
    );
    await databaseClient.query("COMMIT");
    response.json({ ok: true, request: prepareRequest(reviewedRequest) });
  } catch (error) {
    await databaseClient.query("ROLLBACK");
    console.error(error);
    response.status(500).json({ ok: false, error: "Unable to save Request review." });
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
  let transactionOpen = false;

  try {
    await databaseClient.query("BEGIN");
    transactionOpen = true;

    const selectedRequestResult = await databaseClient.query<
      RequestDatabaseRow & {
        organizationId: string;
        clientArchivedAt: Date | null;
      }
    >(
      `
        SELECT
          work_request.organization_id AS "organizationId",
          work_request.id,
          work_request.client_id AS "clientId",
          client.name AS "clientName",
          client.archived_at AS "clientArchivedAt",
          work_request.title,
          work_request.description,
          work_request.service_address_line_1 AS "serviceAddressLine1",
          work_request.service_address_line_2 AS "serviceAddressLine2",
          work_request.service_city AS "serviceCity",
          work_request.service_state AS "serviceState",
          work_request.service_postal_code AS "servicePostalCode",
          work_request.status,
          work_request.approved_job_id AS "approvedJobId",
          work_request.decline_reason AS "declineReason",
          work_request.submitted_at AS "submittedAt",
          work_request.decided_at AS "decidedAt",
          work_request.created_at AS "createdAt",
          work_request.updated_at AS "updatedAt"
        FROM requests work_request
        LEFT JOIN clients client
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

    if (!selectedRequest.clientId || !selectedRequest.clientName) {
      await databaseClient.query("ROLLBACK");

      response.status(409).json({
        ok: false,
        error:
          "Confirm the Client and approved Request details before creating the Job.",
      });
      return;
    }

    if (selectedRequest.clientArchivedAt !== null) {
      await databaseClient.query("ROLLBACK");

      response.status(409).json({
        ok: false,
        error:
          "Restore this Client before approving its Request.",
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
          lifecycle_status AS "lifecycleStatus",
          cancelled_at AS "cancelledAt",
          cancellation_reason AS "cancellationReason",
          archived_at AS "archivedAt",
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
          VALUES ($1, $2, 1, 'original', 'open')
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
          decline_reason AS "declineReason",
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

    await databaseClient.query(
      `
        UPDATE media AS media_record
        SET
          job_id = $2,
          job_cycle_id = $3,
          stage = 'before'
        FROM request_media
        WHERE media_record.organization_id = $1
          AND media_record.id =
                request_media.media_id
          AND request_media.organization_id = $1
          AND request_media.request_id = $4
          AND media_record.job_id IS NULL
          AND media_record.job_cycle_id IS NULL
      `,
      [
        selectedRequest.organizationId,
        createdJob.id,
        createdCycle.cycleId,
        selectedRequest.id,
      ],
    );

    const responsePayload = approveRequestResponseSchema.parse({
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

    await databaseClient.query("COMMIT");
    transactionOpen = false;

    response.status(201).json(responsePayload);
  } catch (error) {
    if (transactionOpen) {
      await databaseClient
        .query("ROLLBACK")
        .catch((rollbackError) => {
          console.error(
            "Unable to roll back Request approval.",
            rollbackError,
          );
        });
    }

    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to approve request.",
    });
  } finally {
    databaseClient.release();
  }
});

requestsRouter.post("/:requestId/decline", async (request, response) => {
  const requestIdResult = idSchema.safeParse(
    request.params.requestId,
  );

  if (!requestIdResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid request ID.",
    });
    return;
  }

  const inputResult = declineRequestSchema.safeParse(
    request.body,
  );

  if (!inputResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid Request decline.",
      details: inputResult.error.flatten(),
    });
    return;
  }

  const databaseClient = await pool.connect();
  let transactionOpen = false;

  try {
    await databaseClient.query("BEGIN");
    transactionOpen = true;

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
          work_request.decline_reason AS "declineReason",
          work_request.submitted_at AS "submittedAt",
          work_request.decided_at AS "decidedAt",
          work_request.created_at AS "createdAt",
          work_request.updated_at AS "updatedAt"
        FROM requests work_request
        LEFT JOIN clients client
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
      transactionOpen = false;

      response.status(404).json({
        ok: false,
        error: "Request was not found.",
      });
      return;
    }

    if (selectedRequest.status !== "open") {
      await databaseClient.query("ROLLBACK");
      transactionOpen = false;

      response.status(409).json({
        ok: false,
        error:
          selectedRequest.status === "approved"
            ? "An approved Request cannot be declined."
            : "Request has already been declined.",
      });
      return;
    }

    const declinedRequestResult = await databaseClient.query<
      Omit<RequestDatabaseRow, "clientName">
    >(
      `
        UPDATE requests
        SET
          status = 'declined',
          decline_reason = $1,
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
          decline_reason AS "declineReason",
          submitted_at AS "submittedAt",
          decided_at AS "decidedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        inputResult.data.reason,
        selectedRequest.organizationId,
        selectedRequest.id,
      ],
    );

    const declinedRequest = declinedRequestResult.rows[0];

    if (!declinedRequest) {
      throw new Error(
        "Request decline update did not return a row.",
      );
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
          'request_declined',
          jsonb_build_object('reason', $3::text)
        )
      `,
      [
        selectedRequest.organizationId,
        selectedRequest.id,
        inputResult.data.reason,
      ],
    );

    const responsePayload = declineRequestResponseSchema.parse({
      ok: true,
      request: prepareRequest({
        ...declinedRequest,
        clientName: selectedRequest.clientName,
      }),
    });

    await databaseClient.query("COMMIT");
    transactionOpen = false;

    response.json(responsePayload);
  } catch (error) {
    if (transactionOpen) {
      await databaseClient
        .query("ROLLBACK")
        .catch((rollbackError) => {
          console.error(
            "Unable to roll back Request decline.",
            rollbackError,
          );
        });
    }

    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to decline request.",
    });
  } finally {
    databaseClient.release();
  }
});
