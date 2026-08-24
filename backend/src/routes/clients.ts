import {
  clientPropertySchema,
  clientRecordSchema,
  clientSchema,
  createClientPropertySchema,
  createClientSchema,
  idSchema,
  jobSchema,
  requestSchema,
  updateClientPropertySchema,
  updateClientSchema,
  type Client,
  type ClientProperty,
  type ClientRecord,
  type Job,
  type Request as WorkRequest,
} from "@vizow/shared";
import {
  Router,
  type Response,
} from "express";
import type {
  Pool,
  PoolClient,
} from "pg";

import { pool } from "../db/pool.js";
import { getOrganizationSlug } from "../organizationScope.js";

type DatabaseExecutor = Pool | PoolClient;
type DateValue = Date | string;

type ClientPropertyJson = {
  id: string;
  label: string;
  isDefault: boolean;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  archivedAt: DateValue | null;
  createdAt: DateValue;
  updatedAt: DateValue;
};

type ClientPropertyDatabaseRow = {
  id: string;
  label: string;
  isDefault: boolean;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ClientDatabaseRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archivedAt: Date | null;
  defaultAddress: ClientPropertyJson | null;
  createdAt: Date;
  updatedAt: Date;
};

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
  status: WorkRequest["status"];
  approvedJobId: string | null;
  declineReason: string | null;
  submittedAt: Date;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

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

type LockedClientRow = {
  organizationId: string;
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archivedAt: Date | null;
};

type LockedPropertyRow = ClientPropertyDatabaseRow & {
  organizationId: string;
  clientId: string;
  clientArchivedAt: Date | null;
};

function toIso(value: DateValue): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function prepareProperty(
  row: ClientPropertyDatabaseRow | ClientPropertyJson,
): ClientProperty {
  return clientPropertySchema.parse({
    ...row,
    archivedAt: row.archivedAt
      ? toIso(row.archivedAt)
      : null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  });
}

function prepareClient(row: ClientDatabaseRow): Client {
  return clientSchema.parse({
    ...row,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    defaultAddress: row.defaultAddress
      ? prepareProperty(row.defaultAddress)
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function prepareRequest(row: RequestDatabaseRow): WorkRequest {
  return requestSchema.parse({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

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
      completedAt:
        row.cycleCompletedAt?.toISOString() ?? null,
      createdAt: row.cycleCreatedAt.toISOString(),
      updatedAt: row.cycleUpdatedAt.toISOString(),
    },
  });
}

async function loadClientRecord(
  database: DatabaseExecutor,
  clientId: string,
): Promise<ClientRecord | null> {
  const clientResult = await database.query<ClientDatabaseRow>(
      `
        SELECT
          client.id,
          client.name,
          client.email,
          client.phone,
          client.notes,
          client.archived_at AS "archivedAt",
          default_property.value AS "defaultAddress",
          client.created_at AS "createdAt",
          client.updated_at AS "updatedAt"
        FROM clients client
        JOIN organizations organization
          ON organization.id = client.organization_id
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'id', property.id,
            'label', property.label,
            'isDefault', property.is_default,
            'addressLine1', property.address_line_1,
            'addressLine2', property.address_line_2,
            'city', property.city,
            'state', property.state,
            'postalCode', property.postal_code,
            'archivedAt', property.archived_at,
            'createdAt', property.created_at,
            'updatedAt', property.updated_at
          ) AS value
          FROM client_addresses property
          WHERE property.organization_id =
            client.organization_id
            AND property.client_id = client.id
            AND property.is_default
            AND property.archived_at IS NULL
          LIMIT 1
        ) default_property ON true
        WHERE organization.slug = $1
          AND client.id = $2
      `,
      [
        getOrganizationSlug(),
        clientId,
      ],
    );

  const propertiesResult = await database.query<ClientPropertyDatabaseRow>(
      `
        SELECT
          property.id,
          property.label,
          property.is_default AS "isDefault",
          property.address_line_1 AS "addressLine1",
          property.address_line_2 AS "addressLine2",
          property.city,
          property.state,
          property.postal_code AS "postalCode",
          property.archived_at AS "archivedAt",
          property.created_at AS "createdAt",
          property.updated_at AS "updatedAt"
        FROM client_addresses property
        JOIN organizations organization
          ON organization.id = property.organization_id
        WHERE organization.slug = $1
          AND property.client_id = $2
        ORDER BY
          property.archived_at NULLS FIRST,
          property.is_default DESC,
          lower(property.label),
          property.created_at
      `,
      [
        getOrganizationSlug(),
        clientId,
      ],
    );

  const requestsResult = await database.query<RequestDatabaseRow>(
      `
        SELECT
          request.id,
          request.client_id AS "clientId",
          client.name AS "clientName",
          request.title,
          request.description,
          request.service_address_line_1
            AS "serviceAddressLine1",
          request.service_address_line_2
            AS "serviceAddressLine2",
          request.service_city AS "serviceCity",
          request.service_state AS "serviceState",
          request.service_postal_code
            AS "servicePostalCode",
          request.status,
          request.approved_job_id AS "approvedJobId",
          request.decline_reason AS "declineReason",
          request.submitted_at AS "submittedAt",
          request.decided_at AS "decidedAt",
          request.created_at AS "createdAt",
          request.updated_at AS "updatedAt"
        FROM requests request
        JOIN clients client
          ON client.organization_id =
            request.organization_id
         AND client.id = request.client_id
        JOIN organizations organization
          ON organization.id = request.organization_id
        WHERE organization.slug = $1
          AND request.client_id = $2
        ORDER BY
          CASE request.status
            WHEN 'open' THEN 0
            WHEN 'approved' THEN 1
            ELSE 2
          END,
          request.submitted_at DESC
      `,
      [
        getOrganizationSlug(),
        clientId,
      ],
    );

  const jobsResult = await database.query<JobDatabaseRow>(
      `
        SELECT
          job.id,
          job.client_id AS "clientId",
          client.name AS "clientName",
          job.title,
          job.description,
          job.service_address_line_1
            AS "serviceAddressLine1",
          job.service_address_line_2
            AS "serviceAddressLine2",
          job.service_city AS "serviceCity",
          job.service_state AS "serviceState",
          job.service_postal_code
            AS "servicePostalCode",
          job.lifecycle_status AS "lifecycleStatus",
          job.cancelled_at AS "cancelledAt",
          job.cancellation_reason AS "cancellationReason",
          job.archived_at AS "archivedAt",
          job.created_at AS "createdAt",
          job.updated_at AS "updatedAt",
          cycle.job_cycle_id AS "cycleId",
          cycle.cycle_number AS "cycleNumber",
          cycle.reason AS "cycleReason",
          cycle.stage AS "cycleStage",
          cycle.opened_at AS "cycleOpenedAt",
          cycle.completed_at AS "cycleCompletedAt",
          cycle.created_at AS "cycleCreatedAt",
          cycle.updated_at AS "cycleUpdatedAt"
        FROM jobs job
        JOIN clients client
          ON client.organization_id = job.organization_id
         AND client.id = job.client_id
        JOIN current_job_cycles cycle
          ON cycle.organization_id = job.organization_id
         AND cycle.job_id = job.id
        JOIN organizations organization
          ON organization.id = job.organization_id
        WHERE organization.slug = $1
          AND job.client_id = $2
        ORDER BY job.updated_at DESC, job.created_at DESC
      `,
      [
        getOrganizationSlug(),
        clientId,
      ],
    );

  const clientRow = clientResult.rows[0];

  if (!clientRow) {
    return null;
  }

  return clientRecordSchema.parse({
    ...prepareClient(clientRow),
    properties: propertiesResult.rows.map(prepareProperty),
    requests: requestsResult.rows.map(prepareRequest),
    jobs: jobsResult.rows.map(prepareJob),
  });
}

async function lockClient(
  database: PoolClient,
  clientId: string,
): Promise<LockedClientRow | null> {
  const result = await database.query<LockedClientRow>(
    `
      SELECT
        client.organization_id AS "organizationId",
        client.id,
        client.name,
        client.email,
        client.phone,
        client.notes,
        client.archived_at AS "archivedAt"
      FROM clients client
      JOIN organizations organization
        ON organization.id = client.organization_id
      WHERE organization.slug = $1
        AND client.id = $2
      FOR UPDATE OF client
    `,
    [
      getOrganizationSlug(),
      clientId,
    ],
  );

  return result.rows[0] ?? null;
}

async function lockProperty(
  database: PoolClient,
  clientId: string,
  propertyId: string,
): Promise<LockedPropertyRow | null> {
  const result = await database.query<LockedPropertyRow>(
    `
      SELECT
        property.organization_id AS "organizationId",
        property.client_id AS "clientId",
        property.id,
        property.label,
        property.is_default AS "isDefault",
        property.address_line_1 AS "addressLine1",
        property.address_line_2 AS "addressLine2",
        property.city,
        property.state,
        property.postal_code AS "postalCode",
        property.archived_at AS "archivedAt",
        property.created_at AS "createdAt",
        property.updated_at AS "updatedAt",
        client.archived_at AS "clientArchivedAt"
      FROM client_addresses property
      JOIN clients client
        ON client.organization_id =
          property.organization_id
       AND client.id = property.client_id
      JOIN organizations organization
        ON organization.id = property.organization_id
      WHERE organization.slug = $1
        AND property.client_id = $2
        AND property.id = $3
      FOR UPDATE OF property, client
    `,
    [
      getOrganizationSlug(),
      clientId,
      propertyId,
    ],
  );

  return result.rows[0] ?? null;
}

async function writeClientEvent(
  database: PoolClient,
  input: {
    organizationId: string;
    clientId: string;
    propertyId?: string | null;
    eventType: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await database.query(
    `
      INSERT INTO client_events (
        organization_id,
        client_id,
        client_address_id,
        event_type,
        details
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      input.organizationId,
      input.clientId,
      input.propertyId ?? null,
      input.eventType,
      input.details ?? {},
    ],
  );
}

async function requireClientRecord(
  database: DatabaseExecutor,
  clientId: string,
): Promise<ClientRecord> {
  const record = await loadClientRecord(database, clientId);

  if (!record) {
    throw new Error(
      "The Client disappeared while preparing the response.",
    );
  }

  return record;
}

function sendValidationError(
  response: Response,
  error: {
    issues: Array<{
      path: PropertyKey[];
      message: string;
    }>;
  },
): void {
  response.status(400).json({
    ok: false,
    error: "Invalid submitted data.",
    details: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export const clientsRouter = Router();

clientsRouter.get("/", async (request, response) => {
  const includeArchived =
    request.query.includeArchived === "true";

  try {
    const result = await pool.query<ClientDatabaseRow>(
      `
        SELECT
          client.id,
          client.name,
          client.email,
          client.phone,
          client.notes,
          client.archived_at AS "archivedAt",
          default_property.value AS "defaultAddress",
          client.created_at AS "createdAt",
          client.updated_at AS "updatedAt"
        FROM clients client
        JOIN organizations organization
          ON organization.id = client.organization_id
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'id', property.id,
            'label', property.label,
            'isDefault', property.is_default,
            'addressLine1', property.address_line_1,
            'addressLine2', property.address_line_2,
            'city', property.city,
            'state', property.state,
            'postalCode', property.postal_code,
            'archivedAt', property.archived_at,
            'createdAt', property.created_at,
            'updatedAt', property.updated_at
          ) AS value
          FROM client_addresses property
          WHERE property.organization_id =
            client.organization_id
            AND property.client_id = client.id
            AND property.is_default
            AND property.archived_at IS NULL
          LIMIT 1
        ) default_property ON true
        WHERE organization.slug = $1
          AND (
            $2::boolean
            OR client.archived_at IS NULL
          )
        ORDER BY
          client.archived_at NULLS FIRST,
          lower(client.name),
          client.created_at
      `,
      [
        getOrganizationSlug(),
        includeArchived,
      ],
    );

    response.json({
      ok: true,
      clients: result.rows.map(prepareClient),
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to load Clients.",
    });
  }
});

clientsRouter.get("/:clientId", async (request, response) => {
  const clientIdResult = idSchema.safeParse(
    request.params.clientId,
  );

  if (!clientIdResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid Client identifier.",
    });
    return;
  }

  try {
    const client = await loadClientRecord(
      pool,
      clientIdResult.data,
    );

    if (!client) {
      response.status(404).json({
        ok: false,
        error: "Client not found.",
      });
      return;
    }

    response.json({
      ok: true,
      client,
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to load Client.",
    });
  }
});

clientsRouter.post("/", async (request, response) => {

  const parsedInput = createClientSchema.safeParse(
    request.body,
  );

  if (!parsedInput.success) {

    sendValidationError(response, parsedInput.error);
    return;
  }

  const {
    name,
    email,
    phone,
    notes,
    defaultAddress,
  } = parsedInput.data;

  const database = await pool.connect();
  let transactionOpen = false;

  try {
    await database.query("BEGIN");
    transactionOpen = true;

    const organizationResult = await database.query<{
      id: string;
    }>(
      `
        SELECT id
        FROM organizations
        WHERE slug = $1
      `,
      [getOrganizationSlug()],
    );

    const organization = organizationResult.rows[0];

    if (!organization) {
      await database.query("ROLLBACK");
      transactionOpen = false;

      response.status(500).json({
        ok: false,
        error: "Configured organization was not found.",
      });
      return;
    }

    const clientResult =
      await database.query<ClientDatabaseRow>(
        `
          INSERT INTO clients (
            organization_id,
            name,
            email,
            phone,
            notes
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING
            id,
            name,
            email,
            phone,
            notes,
            archived_at AS "archivedAt",
            NULL::jsonb AS "defaultAddress",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          organization.id,
          name,
          email,
          phone,
          notes,
        ],
      );

    const createdClient = clientResult.rows[0];

    if (!createdClient) {
      throw new Error(
        "PostgreSQL did not return the created Client.",
      );
    }

    let createdProperty:
      | ClientPropertyDatabaseRow
      | null = null;

    if (defaultAddress) {
      const propertyResult =
        await database.query<ClientPropertyDatabaseRow>(
          `
            INSERT INTO client_addresses (
              organization_id,
              client_id,
              label,
              is_default,
              address_line_1,
              address_line_2,
              city,
              state,
              postal_code
            )
            VALUES (
              $1,
              $2,
              $3,
              true,
              $4,
              $5,
              $6,
              $7,
              $8
            )
            RETURNING
              id,
              label,
              is_default AS "isDefault",
              address_line_1 AS "addressLine1",
              address_line_2 AS "addressLine2",
              city,
              state,
              postal_code AS "postalCode",
              archived_at AS "archivedAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            organization.id,
            createdClient.id,
            defaultAddress.label,
            defaultAddress.addressLine1,
            defaultAddress.addressLine2,
            defaultAddress.city,
            defaultAddress.state,
            defaultAddress.postalCode,
          ],
        );

      createdProperty = propertyResult.rows[0] ?? null;

      if (!createdProperty) {
        throw new Error(
          "PostgreSQL did not return the created Property.",
        );
      }

    } else {
    }

    await writeClientEvent(database, {
      organizationId: organization.id,
      clientId: createdClient.id,
      eventType: "client_created",
      details: {
        name,
        email,
        phone,
      },
    });

    if (createdProperty) {
      await writeClientEvent(database, {
        organizationId: organization.id,
        clientId: createdClient.id,
        propertyId: createdProperty.id,
        eventType: "property_added",
        details: {
          label: createdProperty.label,
          isDefault: true,
        },
      });
    }

    await database.query("COMMIT");
    transactionOpen = false;

    response.status(201).json({
      ok: true,
      client: prepareClient({
        ...createdClient,
        defaultAddress: createdProperty
          ? prepareProperty(createdProperty)
          : null,
      }),
    });
  } catch (error) {
    if (transactionOpen) {
      await database.query("ROLLBACK");
    }

    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to create Client.",
    });
  } finally {
    database.release();
  }
});

clientsRouter.patch("/:clientId", async (request, response) => {

  const clientIdResult = idSchema.safeParse(
    request.params.clientId,
  );
  const inputResult = updateClientSchema.safeParse(
    request.body,
  );

  if (!clientIdResult.success || !inputResult.success) {

    if (!inputResult.success) {
      sendValidationError(response, inputResult.error);
    } else {
      response.status(400).json({
        ok: false,
        error: "Invalid Client identifier.",
      });
    }

    return;
  }

  const database = await pool.connect();
  let transactionOpen = false;

  try {
    await database.query("BEGIN");
    transactionOpen = true;

    const client = await lockClient(
      database,
      clientIdResult.data,
    );

    if (!client) {
      await database.query("ROLLBACK");
      transactionOpen = false;

      response.status(404).json({
        ok: false,
        error: "Client not found.",
      });
      return;
    }

    if (client.archivedAt) {
      await database.query("ROLLBACK");
      transactionOpen = false;

      response.status(409).json({
        ok: false,
        error:
          "Restore this Client before editing the record.",
      });
      return;
    }

    const {
      name,
      email,
      phone,
      notes,
    } = inputResult.data;

    const clientChanged =
      name !== client.name ||
      email !== client.email ||
      phone !== client.phone ||
      notes !== client.notes;

    if (!clientChanged) {

      const record = await requireClientRecord(
        database,
        client.id,
      );

      await database.query("COMMIT");
      transactionOpen = false;

      response.json({
        ok: true,
        client: record,
      });
      return;
    }

    await database.query(
      `
        UPDATE clients
        SET
          name = $3,
          email = $4,
          phone = $5,
          notes = $6,
          updated_at = now()
        WHERE organization_id = $1
          AND id = $2
      `,
      [
        client.organizationId,
        client.id,
        name,
        email,
        phone,
        notes,
      ],
    );

    await writeClientEvent(database, {
      organizationId: client.organizationId,
      clientId: client.id,
      eventType: "client_updated",
      details: {
        before: {
          name: client.name,
          email: client.email,
          phone: client.phone,
          notes: client.notes,
        },
        after: {
          name,
          email,
          phone,
          notes,
        },
      },
    });

    const record = await requireClientRecord(
      database,
      client.id,
    );

    await database.query("COMMIT");
    transactionOpen = false;

    response.json({
      ok: true,
      client: record,
    });
  } catch (error) {
    if (transactionOpen) {
      await database.query("ROLLBACK");
    }

    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to update Client.",
    });
  } finally {
    database.release();
  }
});

clientsRouter.post(
  "/:clientId/archive",
  async (request, response) => {

    const clientIdResult = idSchema.safeParse(
      request.params.clientId,
    );

    if (!clientIdResult.success) {

      response.status(400).json({
        ok: false,
        error: "Invalid Client identifier.",
      });
      return;
    }

    const database = await pool.connect();
    let transactionOpen = false;

    try {
      await database.query("BEGIN");
      transactionOpen = true;

      const client = await lockClient(
        database,
        clientIdResult.data,
      );

      if (!client) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(404).json({
          ok: false,
          error: "Client not found.",
        });
        return;
      }

      if (client.archivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error: "Client is already archived.",
        });
        return;
      }

      await database.query(
        `
          UPDATE clients
          SET
            archived_at = now(),
            updated_at = now()
          WHERE organization_id = $1
            AND id = $2
        `,
        [
          client.organizationId,
          client.id,
        ],
      );

      await writeClientEvent(database, {
        organizationId: client.organizationId,
        clientId: client.id,
        eventType: "client_archived",
        details: {
          name: client.name,
        },
      });

      const record = await requireClientRecord(
        database,
        client.id,
      );

      await database.query("COMMIT");
      transactionOpen = false;

      response.json({
        ok: true,
        client: record,
      });
    } catch (error) {
      if (transactionOpen) {
        await database.query("ROLLBACK");
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to archive Client.",
      });
    } finally {
      database.release();
    }
  },
);

clientsRouter.post(
  "/:clientId/restore",
  async (request, response) => {

    const clientIdResult = idSchema.safeParse(
      request.params.clientId,
    );

    if (!clientIdResult.success) {

      response.status(400).json({
        ok: false,
        error: "Invalid Client identifier.",
      });
      return;
    }

    const database = await pool.connect();
    let transactionOpen = false;

    try {
      await database.query("BEGIN");
      transactionOpen = true;

      const client = await lockClient(
        database,
        clientIdResult.data,
      );

      if (!client) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(404).json({
          ok: false,
          error: "Client not found.",
        });
        return;
      }

      if (!client.archivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error: "Client is already active.",
        });
        return;
      }

      await database.query(
        `
          UPDATE clients
          SET
            archived_at = NULL,
            updated_at = now()
          WHERE organization_id = $1
            AND id = $2
        `,
        [
          client.organizationId,
          client.id,
        ],
      );

      await writeClientEvent(database, {
        organizationId: client.organizationId,
        clientId: client.id,
        eventType: "client_restored",
        details: {
          name: client.name,
        },
      });

      const record = await requireClientRecord(
        database,
        client.id,
      );

      await database.query("COMMIT");
      transactionOpen = false;

      response.json({
        ok: true,
        client: record,
      });
    } catch (error) {
      if (transactionOpen) {
        await database.query("ROLLBACK");
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to restore Client.",
      });
    } finally {
      database.release();
    }
  },
);

clientsRouter.post(
  "/:clientId/properties",
  async (request, response) => {

    const clientIdResult = idSchema.safeParse(
      request.params.clientId,
    );
    const inputResult =
      createClientPropertySchema.safeParse(request.body);

    if (!clientIdResult.success || !inputResult.success) {

      if (!inputResult.success) {
        sendValidationError(response, inputResult.error);
      } else {
        response.status(400).json({
          ok: false,
          error: "Invalid Client identifier.",
        });
      }

      return;
    }

    const database = await pool.connect();
    let transactionOpen = false;

    try {
      await database.query("BEGIN");
      transactionOpen = true;

      const client = await lockClient(
        database,
        clientIdResult.data,
      );

      if (!client) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(404).json({
          ok: false,
          error: "Client not found.",
        });
        return;
      }

      if (client.archivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error:
            "Restore this Client before adding a Property.",
        });
        return;
      }

      const currentDefaultResult =
        await database.query<{ id: string }>(
          `
            SELECT id
            FROM client_addresses
            WHERE organization_id = $1
              AND client_id = $2
              AND is_default
              AND archived_at IS NULL
            FOR UPDATE
          `,
          [
            client.organizationId,
            client.id,
          ],
        );

      const previousDefault =
        currentDefaultResult.rows[0] ?? null;

      const shouldSetDefault =
        inputResult.data.isDefault || !previousDefault;

      if (shouldSetDefault && previousDefault) {
        await database.query(
          `
            UPDATE client_addresses
            SET
              is_default = false,
              updated_at = now()
            WHERE organization_id = $1
              AND client_id = $2
              AND id = $3
          `,
          [
            client.organizationId,
            client.id,
            previousDefault.id,
          ],
        );
      }

      const propertyResult =
        await database.query<ClientPropertyDatabaseRow>(
          `
            INSERT INTO client_addresses (
              organization_id,
              client_id,
              label,
              is_default,
              address_line_1,
              address_line_2,
              city,
              state,
              postal_code
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9
            )
            RETURNING
              id,
              label,
              is_default AS "isDefault",
              address_line_1 AS "addressLine1",
              address_line_2 AS "addressLine2",
              city,
              state,
              postal_code AS "postalCode",
              archived_at AS "archivedAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [
            client.organizationId,
            client.id,
            inputResult.data.label,
            shouldSetDefault,
            inputResult.data.addressLine1,
            inputResult.data.addressLine2,
            inputResult.data.city,
            inputResult.data.state,
            inputResult.data.postalCode,
          ],
        );

      const property = propertyResult.rows[0];

      if (!property) {
        throw new Error(
          "PostgreSQL did not return the created Property.",
        );
      }

      await writeClientEvent(database, {
        organizationId: client.organizationId,
        clientId: client.id,
        propertyId: property.id,
        eventType: "property_added",
        details: {
          label: property.label,
          isDefault: shouldSetDefault,
        },
      });

      if (shouldSetDefault) {
        await writeClientEvent(database, {
          organizationId: client.organizationId,
          clientId: client.id,
          propertyId: property.id,
          eventType: "default_property_changed",
          details: {
            previousPropertyId:
              previousDefault?.id ?? null,
            newPropertyId: property.id,
          },
        });
      }

      const record = await requireClientRecord(
        database,
        client.id,
      );

      await database.query("COMMIT");
      transactionOpen = false;

      response.status(201).json({
        ok: true,
        client: record,
      });
    } catch (error) {
      if (transactionOpen) {
        await database.query("ROLLBACK");
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to add Property.",
      });
    } finally {
      database.release();
    }
  },
);

clientsRouter.patch(
  "/:clientId/properties/:propertyId",
  async (request, response) => {

    const clientIdResult = idSchema.safeParse(
      request.params.clientId,
    );
    const propertyIdResult = idSchema.safeParse(
      request.params.propertyId,
    );
    const inputResult =
      updateClientPropertySchema.safeParse(request.body);

    if (
      !clientIdResult.success ||
      !propertyIdResult.success ||
      !inputResult.success
    ) {

      if (!inputResult.success) {
        sendValidationError(response, inputResult.error);
      } else {
        response.status(400).json({
          ok: false,
          error: "Invalid Client or Property identifier.",
        });
      }

      return;
    }

    const database = await pool.connect();
    let transactionOpen = false;

    try {
      await database.query("BEGIN");
      transactionOpen = true;

      const property = await lockProperty(
        database,
        clientIdResult.data,
        propertyIdResult.data,
      );

      if (!property) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(404).json({
          ok: false,
          error: "Property not found.",
        });
        return;
      }

      if (property.clientArchivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error:
            "Restore this Client before editing Properties.",
        });
        return;
      }

      if (property.archivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error:
            "Restore this Property before editing it.",
        });
        return;
      }

      const propertyChanged =
        inputResult.data.label !== property.label ||
        inputResult.data.addressLine1 !== property.addressLine1 ||
        inputResult.data.addressLine2 !== property.addressLine2 ||
        inputResult.data.city !== property.city ||
        inputResult.data.state !== property.state ||
        inputResult.data.postalCode !== property.postalCode;

      if (!propertyChanged) {

        const record = await requireClientRecord(
          database,
          property.clientId,
        );

        await database.query("COMMIT");
        transactionOpen = false;

        response.json({
          ok: true,
          client: record,
        });
        return;
      }

      await database.query(
        `
          UPDATE client_addresses
          SET
            label = $4,
            address_line_1 = $5,
            address_line_2 = $6,
            city = $7,
            state = $8,
            postal_code = $9,
            updated_at = now()
          WHERE organization_id = $1
            AND client_id = $2
            AND id = $3
        `,
        [
          property.organizationId,
          property.clientId,
          property.id,
          inputResult.data.label,
          inputResult.data.addressLine1,
          inputResult.data.addressLine2,
          inputResult.data.city,
          inputResult.data.state,
          inputResult.data.postalCode,
        ],
      );

      await writeClientEvent(database, {
        organizationId: property.organizationId,
        clientId: property.clientId,
        propertyId: property.id,
        eventType: "property_updated",
        details: {
          before: {
            label: property.label,
            addressLine1: property.addressLine1,
            addressLine2: property.addressLine2,
            city: property.city,
            state: property.state,
            postalCode: property.postalCode,
          },
          after: inputResult.data,
        },
      });

      const record = await requireClientRecord(
        database,
        property.clientId,
      );

      await database.query("COMMIT");
      transactionOpen = false;

      response.json({
        ok: true,
        client: record,
      });
    } catch (error) {
      if (transactionOpen) {
        await database.query("ROLLBACK");
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to update Property.",
      });
    } finally {
      database.release();
    }
  },
);

clientsRouter.post(
  "/:clientId/properties/:propertyId/archive",
  async (request, response) => {

    const clientIdResult = idSchema.safeParse(
      request.params.clientId,
    );
    const propertyIdResult = idSchema.safeParse(
      request.params.propertyId,
    );

    if (!clientIdResult.success || !propertyIdResult.success) {

      response.status(400).json({
        ok: false,
        error: "Invalid Client or Property identifier.",
      });
      return;
    }

    const database = await pool.connect();
    let transactionOpen = false;

    try {
      await database.query("BEGIN");
      transactionOpen = true;

      const property = await lockProperty(
        database,
        clientIdResult.data,
        propertyIdResult.data,
      );

      if (!property) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(404).json({
          ok: false,
          error: "Property not found.",
        });
        return;
      }

      if (property.clientArchivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error:
            "Restore this Client before archiving a Property.",
        });
        return;
      }

      if (property.archivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error: "Property is already archived.",
        });
        return;
      }

      const replacementDefaultId: string | null = null;

      if (property.isDefault) {
        await database.query(
          `
            UPDATE client_addresses
            SET
              is_default = false,
              updated_at = now()
            WHERE organization_id = $1
              AND client_id = $2
              AND id = $3
          `,
          [
            property.organizationId,
            property.clientId,
            property.id,
          ],
        );
      }

      await database.query(
        `
          UPDATE client_addresses
          SET
            is_default = false,
            archived_at = now(),
            updated_at = now()
          WHERE organization_id = $1
            AND client_id = $2
            AND id = $3
        `,
        [
          property.organizationId,
          property.clientId,
          property.id,
        ],
      );

      await writeClientEvent(database, {
        organizationId: property.organizationId,
        clientId: property.clientId,
        propertyId: property.id,
        eventType: "property_archived",
        details: {
          label: property.label,
          wasDefault: property.isDefault,
        },
      });

      if (property.isDefault) {
        await writeClientEvent(database, {
          organizationId: property.organizationId,
          clientId: property.clientId,
          propertyId: replacementDefaultId,
          eventType: "default_property_changed",
          details: {
            previousPropertyId: property.id,
            newPropertyId: replacementDefaultId,
          },
        });
      }

      const record = await requireClientRecord(
        database,
        property.clientId,
      );

      await database.query("COMMIT");
      transactionOpen = false;

      response.json({
        ok: true,
        client: record,
      });
    } catch (error) {
      if (transactionOpen) {
        await database.query("ROLLBACK");
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to archive Property.",
      });
    } finally {
      database.release();
    }
  },
);

clientsRouter.post(
  "/:clientId/properties/:propertyId/restore",
  async (request, response) => {

    const clientIdResult = idSchema.safeParse(
      request.params.clientId,
    );
    const propertyIdResult = idSchema.safeParse(
      request.params.propertyId,
    );

    if (!clientIdResult.success || !propertyIdResult.success) {

      response.status(400).json({
        ok: false,
        error: "Invalid Client or Property identifier.",
      });
      return;
    }

    const database = await pool.connect();
    let transactionOpen = false;

    try {
      await database.query("BEGIN");
      transactionOpen = true;

      const property = await lockProperty(
        database,
        clientIdResult.data,
        propertyIdResult.data,
      );

      if (!property) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(404).json({
          ok: false,
          error: "Property not found.",
        });
        return;
      }

      if (property.clientArchivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error:
            "Restore this Client before restoring Properties.",
        });
        return;
      }

      if (!property.archivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error: "Property is already active.",
        });
        return;
      }

      await database.query(
        `
          UPDATE client_addresses
          SET
            archived_at = NULL,
            is_default = false,
            updated_at = now()
          WHERE organization_id = $1
            AND client_id = $2
            AND id = $3
        `,
        [
          property.organizationId,
          property.clientId,
          property.id,
        ],
      );

      await writeClientEvent(database, {
        organizationId: property.organizationId,
        clientId: property.clientId,
        propertyId: property.id,
        eventType: "property_restored",
        details: {
          label: property.label,
        },
      });

      const record = await requireClientRecord(
        database,
        property.clientId,
      );

      await database.query("COMMIT");
      transactionOpen = false;

      response.json({
        ok: true,
        client: record,
      });
    } catch (error) {
      if (transactionOpen) {
        await database.query("ROLLBACK");
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to restore Property.",
      });
    } finally {
      database.release();
    }
  },
);

clientsRouter.post(
  "/:clientId/properties/:propertyId/default",
  async (request, response) => {

    const clientIdResult = idSchema.safeParse(
      request.params.clientId,
    );
    const propertyIdResult = idSchema.safeParse(
      request.params.propertyId,
    );

    if (!clientIdResult.success || !propertyIdResult.success) {

      response.status(400).json({
        ok: false,
        error: "Invalid Client or Property identifier.",
      });
      return;
    }

    const database = await pool.connect();
    let transactionOpen = false;

    try {
      await database.query("BEGIN");
      transactionOpen = true;

      const property = await lockProperty(
        database,
        clientIdResult.data,
        propertyIdResult.data,
      );

      if (!property) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(404).json({
          ok: false,
          error: "Property not found.",
        });
        return;
      }

      if (property.clientArchivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error:
            "Restore this Client before changing the default Property.",
        });
        return;
      }

      if (property.archivedAt) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error:
            "Restore this Property before setting it as default.",
        });
        return;
      }

      if (property.isDefault) {
        await database.query("ROLLBACK");
        transactionOpen = false;

        response.status(409).json({
          ok: false,
          error: "Property is already the default.",
        });
        return;
      }

      const currentDefaultResult =
        await database.query<{ id: string }>(
          `
            SELECT id
            FROM client_addresses
            WHERE organization_id = $1
              AND client_id = $2
              AND is_default
              AND archived_at IS NULL
            FOR UPDATE
          `,
          [
            property.organizationId,
            property.clientId,
          ],
        );

      const previousDefaultId =
        currentDefaultResult.rows[0]?.id ?? null;

      await database.query(
        `
          UPDATE client_addresses
          SET
            is_default = false,
            updated_at = now()
          WHERE organization_id = $1
            AND client_id = $2
            AND is_default
        `,
        [
          property.organizationId,
          property.clientId,
        ],
      );

      await database.query(
        `
          UPDATE client_addresses
          SET
            is_default = true,
            updated_at = now()
          WHERE organization_id = $1
            AND client_id = $2
            AND id = $3
        `,
        [
          property.organizationId,
          property.clientId,
          property.id,
        ],
      );

      await writeClientEvent(database, {
        organizationId: property.organizationId,
        clientId: property.clientId,
        propertyId: property.id,
        eventType: "default_property_changed",
        details: {
          previousPropertyId: previousDefaultId,
          newPropertyId: property.id,
        },
      });

      const record = await requireClientRecord(
        database,
        property.clientId,
      );

      await database.query("COMMIT");
      transactionOpen = false;

      response.json({
        ok: true,
        client: record,
      });
    } catch (error) {
      if (transactionOpen) {
        await database.query("ROLLBACK");
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to change default Property.",
      });
    } finally {
      database.release();
    }
  },
);
