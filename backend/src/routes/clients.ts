import {
  clientSchema,
  createClientSchema,
  type Client,
  type ClientAddress,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { env } from "../env.js";
import {
  advanceOperation,
  beginOperation,
  completeOperation,
  failOperation,
  operationIdFromRequest,
} from "../operations/operationTracker.js";

type ClientDatabaseRow = Omit<
  Client,
  "createdAt" | "updatedAt"
> & {
  createdAt: Date;
  updatedAt: Date;
};

function prepareClient(row: ClientDatabaseRow): Client {
  return clientSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export const clientsRouter = Router();

clientsRouter.get("/", async (_request, response) => {
  try {
    const result = await pool.query<ClientDatabaseRow>(
      `
        SELECT
          clients.id,
          clients.name,
          clients.email,
          clients.phone,
          clients.notes,
          default_address.value AS "defaultAddress",
          clients.created_at AS "createdAt",
          clients.updated_at AS "updatedAt"
        FROM clients
        INNER JOIN organizations
          ON organizations.id = clients.organization_id
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'id', client_address.id,
            'label', client_address.label,
            'isDefault', client_address.is_default,
            'addressLine1', client_address.address_line_1,
            'addressLine2', client_address.address_line_2,
            'city', client_address.city,
            'state', client_address.state,
            'postalCode', client_address.postal_code
          ) AS value
          FROM client_addresses client_address
          WHERE client_address.organization_id = clients.organization_id
            AND client_address.client_id = clients.id
            AND client_address.is_default
          LIMIT 1
        ) default_address ON true
        WHERE organizations.slug = $1
        ORDER BY lower(clients.name), clients.created_at
      `,
      [env.ORGANIZATION_SLUG],
    );

    response.json({
      ok: true,
      clients: result.rows.map(prepareClient),
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to load clients.",
    });
  }
});

clientsRouter.post("/", async (request, response) => {
  const operationId = operationIdFromRequest(request);

  beginOperation(
    operationId,
    "create_client",
    "Sending this Client through VIZOW.",
  );
  advanceOperation(
    operationId,
    "received",
    "The VIZOW server received this Client.",
  );

  const parsedInput = createClientSchema.safeParse(request.body);

  if (!parsedInput.success) {
    failOperation(
      operationId,
      "validated",
      "The Client information was rejected. Nothing was changed.",
    );

    response.status(400).json({
      ok: false,
      error: "Invalid client data.",
      details: parsedInput.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  advanceOperation(
    operationId,
    "validated",
    "The Client information is valid.",
  );

  const {
    name,
    email,
    phone,
    notes,
    defaultAddress,
  } = parsedInput.data;

  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const organizationResult = await databaseClient.query<{
      id: string;
    }>(
      `
        SELECT id
        FROM organizations
        WHERE slug = $1
      `,
      [env.ORGANIZATION_SLUG],
    );

    const organization = organizationResult.rows[0];

    if (!organization) {
      await databaseClient.query("ROLLBACK");

      failOperation(
        operationId,
        "organization_verified",
        "The configured organization was not found. Nothing was changed.",
      );

      response.status(500).json({
        ok: false,
        error: "Configured organization was not found.",
      });
      return;
    }

    advanceOperation(
      operationId,
      "organization_verified",
      "The VIZOW organization was verified.",
    );

    const clientResult = await databaseClient.query<ClientDatabaseRow>(
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
      throw new Error("PostgreSQL did not return the created Client.");
    }

    advanceOperation(
      operationId,
      "client_written",
      "The Client record was written inside the transaction.",
    );

    let createdAddress: ClientAddress | null = null;

    if (defaultAddress) {
      const addressResult = await databaseClient.query<ClientAddress>(
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
          VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8)
          RETURNING
            id,
            label,
            is_default AS "isDefault",
            address_line_1 AS "addressLine1",
            address_line_2 AS "addressLine2",
            city,
            state,
            postal_code AS "postalCode"
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

      createdAddress = addressResult.rows[0] ?? null;

      if (!createdAddress) {
        throw new Error(
          "PostgreSQL did not return the created Client property.",
        );
      }

      advanceOperation(
        operationId,
        "address_written",
        "The default service property was written.",
      );
    } else {
      advanceOperation(
        operationId,
        "address_written",
        "No default service property was provided.",
      );
    }

    await databaseClient.query("COMMIT");

    advanceOperation(
      operationId,
      "committed",
      "PostgreSQL committed the Client and property.",
    );
    advanceOperation(
      operationId,
      "response_ready",
      "The confirmed Client is ready to return.",
    );
    completeOperation(
      operationId,
      "Client committed. The server confirmed the save.",
    );

    response.status(201).json({
      ok: true,
      client: prepareClient({
        ...createdClient,
        defaultAddress: createdAddress,
      }),
    });
  } catch (error) {
    await databaseClient.query("ROLLBACK");

    failOperation(
      operationId,
      null,
      "Creating the Client failed. The transaction was rolled back.",
    );

    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to create client.",
    });
  } finally {
    databaseClient.release();
  }
});
