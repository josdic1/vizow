import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { env } from "../env.js";

const { Client } = pg;

const migrationFilePattern = /^\d{3}_[a-z0-9_]+\.sql$/;
const migrationLockName = "vizow-schema-migrations";

const migrationDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../db/migrations",
);

const baselineRelations = [
  "organizations",
  "clients",
  "client_addresses",
  "client_events",
  "jobs",
  "requests",
  "request_events",
  "job_cycles",
  "job_events",
  "scope_revisions",
  "visits",
  "closures",
  "media",
  "field_notes",
  "disputes",
  "vows",
  "vow_jobs",
  "vow_media",
  "vow_outputs",
  "current_job_cycles",
] as const;

type AppliedMigrationRow = {
  filename: string;
  checksum: string;
};

function calculateChecksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

function removeOuterTransaction(sql: string): string {
  const normalizedSql = sql.replace(/^\uFEFF/, "");

  const transactionMatch = normalizedSql.match(
    /^\s*BEGIN\s*;\s*([\s\S]*?)\s*COMMIT\s*;\s*$/i,
  );

  return transactionMatch?.[1] ?? normalizedSql;
}

async function loadMigrationFiles(): Promise<string[]> {
  const entries = await readdir(migrationDirectory, {
    withFileTypes: true,
  });

  return entries
    .filter(
      (entry) =>
        entry.isFile() && migrationFilePattern.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function ensureMigrationTable(
  client: InstanceType<typeof Client>,
): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function readAppliedMigrations(
  client: InstanceType<typeof Client>,
): Promise<Map<string, string>> {
  const result = await client.query<AppliedMigrationRow>(`
    SELECT filename, checksum
    FROM schema_migrations
    ORDER BY filename
  `);

  return new Map(
    result.rows.map((row) => [row.filename, row.checksum]),
  );
}

function assertMigrationHistoryMatchesFiles(
  migrationFiles: string[],
  appliedMigrations: Map<string, string>,
): void {
  const availableFiles = new Set(migrationFiles);
  const appliedFiles = [...appliedMigrations.keys()];

  const missingFiles = appliedFiles.filter(
    (filename) => !availableFiles.has(filename),
  );

  if (missingFiles.length > 0) {
    throw new Error(
      [
        "Applied migrations are missing from backend/db/migrations:",
        ...missingFiles.map((filename) => `- ${filename}`),
      ].join("\n"),
    );
  }

  const expectedAppliedPrefix = migrationFiles.slice(
    0,
    appliedFiles.length,
  );

  const historyIsOrdered = appliedFiles.every(
    (filename, index) =>
      filename === expectedAppliedPrefix[index],
  );

  if (!historyIsOrdered) {
    throw new Error(
      [
        "Migration history is not a continuous ordered prefix.",
        `Recorded: ${appliedFiles.join(", ")}`,
        `Expected: ${expectedAppliedPrefix.join(", ")}`,
      ].join("\n"),
    );
  }
}

async function databaseContainsVizowSchema(
  client: InstanceType<typeof Client>,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`
    SELECT to_regclass('public.organizations') IS NOT NULL AS exists
  `);

  return result.rows[0]?.exists ?? false;
}

async function assertBaselineRelationsExist(
  client: InstanceType<typeof Client>,
): Promise<void> {
  const result = await client.query<{
    relation_name: string;
    relation_oid: string | null;
  }>(
    `
      SELECT
        relation_name,
        to_regclass('public.' || relation_name) AS relation_oid
      FROM unnest($1::text[]) AS relation_name
      ORDER BY relation_name
    `,
    [baselineRelations],
  );

  const missingRelations = result.rows
    .filter((row) => row.relation_oid === null)
    .map((row) => row.relation_name);

  if (missingRelations.length > 0) {
    throw new Error(
      [
        "The existing database cannot be baselined.",
        "These required schema objects are missing:",
        ...missingRelations.map((name) => `- ${name}`),
      ].join("\n"),
    );
  }
}

function readBaselineFilename(): string | null {
  const baselineArgumentIndex = process.argv.indexOf("--baseline");

  if (baselineArgumentIndex === -1) {
    return null;
  }

  const filename = process.argv[baselineArgumentIndex + 1];

  if (!filename) {
    throw new Error(
      "A migration filename is required after --baseline.",
    );
  }

  return filename;
}

async function recordExistingBaseline(
  client: InstanceType<typeof Client>,
  migrationFiles: string[],
  appliedMigrations: Map<string, string>,
  filename: string,
): Promise<void> {
  if (filename !== migrationFiles[0]) {
    throw new Error(
      `Only the first migration may be baselined. Expected ${migrationFiles[0]}.`,
    );
  }

  if (appliedMigrations.size > 0) {
    throw new Error(
      "Baseline refused because schema_migrations already contains records.",
    );
  }

  const migrationPath = path.join(migrationDirectory, filename);
  const sql = await readFile(migrationPath, "utf8");
  const checksum = calculateChecksum(sql);

  await assertBaselineRelationsExist(client);

  await client.query(
    `
      INSERT INTO schema_migrations (
        filename,
        checksum
      )
      VALUES ($1, $2)
    `,
    [filename, checksum],
  );

  console.log(`Baselined existing database at ${filename}.`);
}

async function applyPendingMigrations(
  client: InstanceType<typeof Client>,
  migrationFiles: string[],
  appliedMigrations: Map<string, string>,
): Promise<void> {
  let appliedCount = 0;

  for (const filename of migrationFiles) {
    const migrationPath = path.join(migrationDirectory, filename);
    const originalSql = await readFile(migrationPath, "utf8");
    const checksum = calculateChecksum(originalSql);
    const recordedChecksum = appliedMigrations.get(filename);

    if (recordedChecksum) {
      if (recordedChecksum !== checksum) {
        throw new Error(
          `Migration checksum changed after application: ${filename}`,
        );
      }

      console.log(`Already applied: ${filename}`);
      continue;
    }

    if (
      filename === migrationFiles[0] &&
      (await databaseContainsVizowSchema(client))
    ) {
      throw new Error(
        [
          "An existing Vizow schema was found, but no baseline is recorded.",
          "Do not rerun 000_initial.sql against this database.",
          "Verify the installed schema before using:",
          `npm run db:migrate --workspace @vizow/backend -- --baseline ${filename}`,
        ].join("\n"),
      );
    }

    const executableSql = removeOuterTransaction(originalSql);

    try {
      await client.query("BEGIN");
      await client.query(executableSql);

      await client.query(
        `
          INSERT INTO schema_migrations (
            filename,
            checksum
          )
          VALUES ($1, $2)
        `,
        [filename, checksum],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    appliedCount += 1;
    console.log(`Applied: ${filename}`);
  }

  if (appliedCount === 0) {
    console.log("No pending migrations.");
  }
}

async function main(): Promise<void> {
  const client = new Client({
    connectionString: env.DATABASE_URL,
  });

  await client.connect();

  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtextextended($1, 0))",
      [migrationLockName],
    );

    await ensureMigrationTable(client);

    const migrationFiles = await loadMigrationFiles();

    if (migrationFiles.length === 0) {
      throw new Error(
        `No migration files were found in ${migrationDirectory}.`,
      );
    }

    const appliedMigrations = await readAppliedMigrations(client);

    assertMigrationHistoryMatchesFiles(
      migrationFiles,
      appliedMigrations,
    );

    const baselineFilename = readBaselineFilename();

    if (baselineFilename) {
      await recordExistingBaseline(
        client,
        migrationFiles,
        appliedMigrations,
        baselineFilename,
      );

      return;
    }

    await applyPendingMigrations(
      client,
      migrationFiles,
      appliedMigrations,
    );
  } finally {
    await client
      .query(
        "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
        [migrationLockName],
      )
      .catch(() => undefined);

    await client.end();
  }
}

await main();
