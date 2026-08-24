import { AsyncLocalStorage } from "node:async_hooks";

import type { NextFunction, Request, Response } from "express";

import { pool } from "./db/pool.js";
import { env } from "./env.js";
import { hashDemoSessionToken, readDemoSessionToken } from "./services/demoSessionToken.js";

type OrganizationScope = {
  organizationId: string;
  organizationSlug: string;
  demoSessionId: string | null;
};

const organizationScope = new AsyncLocalStorage<OrganizationScope>();

export function getOrganizationSlug(): string {
  return organizationScope.getStore()?.organizationSlug ?? env.ORGANIZATION_SLUG;
}

export function getOrganizationId(): string | null {
  return organizationScope.getStore()?.organizationId ?? null;
}

export function getDemoSessionId(): string | null {
  return organizationScope.getStore()?.demoSessionId ?? null;
}

export async function requireOrganizationScope(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  if (!env.DEMO_SESSIONS_ENABLED) {
    next();
    return;
  }

  const token = readDemoSessionToken(request.headers.cookie);

  if (!token) {
    response.status(401).json({
      ok: false,
      code: "DEMO_SESSION_REQUIRED",
      error: "Start a private Vizow demo first.",
    });
    return;
  }

  try {
    const tokenHash = hashDemoSessionToken(token);
    const result = await pool.query<{
      sessionId: string;
      organizationId: string;
      organizationSlug: string;
    }>(
      `
        SELECT
          demo_session.id AS "sessionId",
          organization.id AS "organizationId",
          organization.slug AS "organizationSlug"
        FROM demo_sessions demo_session
        JOIN organizations organization
          ON organization.id = demo_session.organization_id
        WHERE demo_session.token_hash = $1
          AND demo_session.expires_at > now()
          AND organization.is_demo = true
          AND organization.demo_expires_at > now()
        LIMIT 1
      `,
      [tokenHash],
    );

    const session = result.rows[0];

    if (!session) {
      response.status(401).json({
        ok: false,
        code: "DEMO_SESSION_EXPIRED",
        error: "This Vizow demo has expired. Start a new private demo.",
      });
      return;
    }

    void pool.query(
      `
        UPDATE demo_sessions
        SET last_seen_at = now()
        WHERE id = $1
      `,
      [session.sessionId],
    ).catch((error: unknown) => {
      console.error("Unable to update demo session activity.", error);
    });

    organizationScope.run(
      {
        organizationId: session.organizationId,
        organizationSlug: session.organizationSlug,
        demoSessionId: session.sessionId,
      },
      next,
    );
  } catch (error) {
    console.error(error);
    response.status(500).json({
      ok: false,
      error: "Unable to resolve the Vizow workspace.",
    });
  }
}
