import type { PoolClient } from "pg";
import { Router } from "express";

import { pool } from "../db/pool.js";
import {
  seedRealisticSampleData,
  type SampleRange,
} from "../services/sampleDataSeed.js";

export const adminSampleDataRouter = Router();

const SAMPLE_PREFIX = "f17a5eed-";

function isSampleRange(value: string): value is SampleRange {
  return (
    value === "day" ||
    value === "week" ||
    value === "month"
  );
}

async function tableExists(
  client: PoolClient,
  tableName: string,
): Promise<boolean> {
  const result = await client.query<{ tableName: string | null }>(
    `SELECT to_regclass($1) AS "tableName"`,
    [`public.${tableName}`],
  );

  return result.rows[0]?.tableName !== null;
}

async function clearSampleData(
  client: PoolClient,
  organizationId: string,
): Promise<void> {
  const like = `${SAMPLE_PREFIX}%`;

  if (await tableExists(client, "request_events")) {
    await client.query(
      `
        DELETE FROM request_events
        WHERE organization_id = $1
          AND request_id::text LIKE $2
      `,
      [organizationId, like],
    );
  }

  if (await tableExists(client, "request_media")) {
    await client.query(
      `
        DELETE FROM request_media
        WHERE organization_id = $1
          AND request_id::text LIKE $2
      `,
      [organizationId, like],
    );
  }

  await client.query(
    `
      DELETE FROM vow_outputs
      WHERE organization_id = $1
        AND vow_id IN (
          SELECT id
          FROM vows
          WHERE organization_id = $1
            AND client_id::text LIKE $2
        )
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM vow_media
      WHERE organization_id = $1
        AND vow_id IN (
          SELECT id
          FROM vows
          WHERE organization_id = $1
            AND client_id::text LIKE $2
        )
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM vow_jobs
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM vows
      WHERE organization_id = $1
        AND client_id::text LIKE $2
    `,
    [organizationId, like],
  );

  if (await tableExists(client, "scope_revision_visits")) {
    await client.query(
      `
        DELETE FROM scope_revision_visits
        WHERE organization_id = $1
          AND job_id::text LIKE $2
      `,
      [organizationId, like],
    );
  }

  await client.query(
    `
      DELETE FROM scope_revisions
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM field_notes
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM media
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM closures
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM disputes
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM visits
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  if (await tableExists(client, "job_journey_summaries")) {
    await client.query(
      `
        DELETE FROM job_journey_summaries
        WHERE organization_id = $1
          AND job_id::text LIKE $2
      `,
      [organizationId, like],
    );
  }

  await client.query(
    `
      DELETE FROM job_events
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM requests
      WHERE organization_id = $1
        AND id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM job_cycles
      WHERE organization_id = $1
        AND job_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM jobs
      WHERE organization_id = $1
        AND id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM client_events
      WHERE organization_id = $1
        AND client_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM client_addresses
      WHERE organization_id = $1
        AND client_id::text LIKE $2
    `,
    [organizationId, like],
  );

  await client.query(
    `
      DELETE FROM clients
      WHERE organization_id = $1
        AND id::text LIKE $2
    `,
    [organizationId, like],
  );
}

async function clearAllTransactionalData(
  client: PoolClient,
): Promise<void> {
  await client.query(`
    DO $$
    DECLARE
      statement text;
    BEGIN
      SELECT
        'TRUNCATE TABLE ' ||
        string_agg(format('%I.%I', schemaname, tablename), ', ') ||
        ' RESTART IDENTITY CASCADE'
      INTO statement
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('organizations', 'schema_migrations');

      IF statement IS NOT NULL THEN
        EXECUTE statement;
      END IF;
    END
    $$;
  `);
}

adminSampleDataRouter.post("/:range", async (request, response) => {
  const rawRange = request.params.range;

  if (!isSampleRange(rawRange)) {
    response.status(400).json({
      ok: false,
      error: "Sample range must be day, week, or month.",
    });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const counts = await seedRealisticSampleData(
      client,
      rawRange,
      clearSampleData,
    );

    await client.query("COMMIT");

    response.status(201).json({
      ok: true,
      range: rawRange,
      counts,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    response.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load sample data.",
    });
  } finally {
    client.release();
  }
});

adminSampleDataRouter.delete("/", async (_request, response) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await clearAllTransactionalData(client);
    await client.query("COMMIT");

    response.json({
      ok: true,
      message: "All transactional data cleared.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    response.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to clear sample data.",
    });
  } finally {
    client.release();
  }
});
