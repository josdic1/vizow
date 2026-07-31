import {
  clientSchema,
  createClientSchema,
  type Client,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { env } from "../env.js";

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
          clients.created_at AS "createdAt",
          clients.updated_at AS "updatedAt"
        FROM clients
        INNER JOIN organizations
          ON organizations.id = clients.organization_id
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
  const parsedInput = createClientSchema.safeParse(request.body);

  if (!parsedInput.success) {
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

  const { name, email, phone, notes } = parsedInput.data;

  try {
    const result = await pool.query<ClientDatabaseRow>(
      `
        INSERT INTO clients (
          organization_id,
          name,
          email,
          phone,
          notes
        )
        SELECT
          organizations.id,
          $2,
          $3,
          $4,
          $5
        FROM organizations
        WHERE organizations.slug = $1
        RETURNING
          id,
          name,
          email,
          phone,
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        env.ORGANIZATION_SLUG,
        name,
        email,
        phone,
        notes,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      response.status(500).json({
        ok: false,
        error: "Configured organization was not found.",
      });
      return;
    }

    response.status(201).json({
      ok: true,
      client: prepareClient(row),
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to create client.",
    });
  }
});
