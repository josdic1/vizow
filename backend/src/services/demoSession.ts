import { randomBytes } from "node:crypto";

import type { PoolClient } from "pg";

import { env } from "../env.js";
import { hashDemoSessionToken } from "./demoSessionToken.js";
import { seedRealisticSampleData } from "./sampleDataSeed.js";

export type CreatedDemoWorkspace = {
  token: string;
  sessionId: string;
  organizationId: string;
  organizationSlug: string;
  expiresAt: Date;
};

async function insertDemoOrganization(
  client: PoolClient,
  expiresAt: Date,
): Promise<{ id: string; slug: string }> {
  const slug = `demo-${randomBytes(9).toString("hex")}`;

  const template = await client.query<{
    name: string;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
    brandSettings: unknown;
  }>(
    `
      SELECT
        name,
        email,
        phone,
        logo_url AS "logoUrl",
        brand_settings AS "brandSettings"
      FROM organizations
      WHERE slug = $1
      LIMIT 1
    `,
    [env.ORGANIZATION_SLUG],
  );

  const source = template.rows[0];
  const inserted = await client.query<{ id: string; slug: string }>(
    `
      INSERT INTO organizations (
        name,
        slug,
        email,
        phone,
        logo_url,
        brand_settings,
        is_demo,
        demo_expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, true, $7)
      RETURNING id, slug
    `,
    [
      source?.name ?? "Vizow Demo",
      slug,
      source?.email ?? null,
      source?.phone ?? null,
      source?.logoUrl ?? null,
      JSON.stringify(source?.brandSettings ?? {}),
      expiresAt,
    ],
  );

  const organization = inserted.rows[0];

  if (!organization) {
    throw new Error("Unable to create the private demo workspace.");
  }

  return organization;
}

export async function createPrivateDemoWorkspace(
  client: PoolClient,
): Promise<CreatedDemoWorkspace> {
  const expiresAt = new Date(
    Date.now() + env.DEMO_SESSION_HOURS * 60 * 60 * 1000,
  );
  const organization = await insertDemoOrganization(client, expiresAt);

  await seedRealisticSampleData(
    client,
    "demo",
    async () => undefined,
    organization.slug,
  );

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashDemoSessionToken(token);
  const session = await client.query<{ id: string }>(
    `
      INSERT INTO demo_sessions (
        organization_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [organization.id, tokenHash, expiresAt],
  );
  const sessionId = session.rows[0]?.id;

  if (!sessionId) {
    throw new Error("Unable to create the private demo session.");
  }

  return {
    token,
    sessionId,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    expiresAt,
  };
}

export async function replacePrivateDemoWorkspace(
  client: PoolClient,
  sessionId: string,
  token: string,
): Promise<CreatedDemoWorkspace> {
  const current = await client.query<{ organizationId: string }>(
    `
      SELECT organization_id AS "organizationId"
      FROM demo_sessions
      WHERE id = $1
      FOR UPDATE
    `,
    [sessionId],
  );
  const oldOrganizationId = current.rows[0]?.organizationId;

  if (!oldOrganizationId) {
    throw new Error("Demo session was not found.");
  }

  const expiresAt = new Date(
    Date.now() + env.DEMO_SESSION_HOURS * 60 * 60 * 1000,
  );
  const organization = await insertDemoOrganization(client, expiresAt);

  await seedRealisticSampleData(
    client,
    "demo",
    async () => undefined,
    organization.slug,
  );

  // Keep the same session token during reset. Rotating it here can invalidate
  // in-flight requests from the live app before the browser receives the new
  // cookie, which makes Reset appear to throw the tester out of the demo.
  await client.query(
    `
      UPDATE demo_sessions
      SET
        organization_id = $2,
        created_at = now(),
        last_seen_at = now(),
        expires_at = $3
      WHERE id = $1
    `,
    [sessionId, organization.id, expiresAt],
  );

  await client.query(
    `
      UPDATE organizations
      SET demo_expires_at = now()
      WHERE id = $1
        AND is_demo = true
    `,
    [oldOrganizationId],
  );

  return {
    token,
    sessionId,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    expiresAt,
  };
}
