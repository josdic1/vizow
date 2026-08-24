import { Router } from "express";

import { pool } from "../db/pool.js";
import { env } from "../env.js";
import { getDemoSessionId, requireOrganizationScope } from "../organizationScope.js";
import {
  createPrivateDemoWorkspace,
  replacePrivateDemoWorkspace,
} from "../services/demoSession.js";
import {
  createDemoSessionCookie,
  hashDemoSessionToken,
  readDemoSessionToken,
} from "../services/demoSessionToken.js";

export const demoSessionRouter = Router();

demoSessionRouter.get("/", async (request, response) => {
  if (!env.DEMO_SESSIONS_ENABLED) {
    response.json({
      ok: true,
      enabled: false,
      active: false,
    });
    return;
  }

  const token = readDemoSessionToken(request.headers.cookie);

  if (!token) {
    response.json({
      ok: true,
      enabled: true,
      active: false,
    });
    return;
  }

  try {
    const result = await pool.query<{ active: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM demo_sessions demo_session
          JOIN organizations organization
            ON organization.id = demo_session.organization_id
          WHERE demo_session.token_hash = $1
            AND demo_session.expires_at > now()
            AND organization.is_demo = true
            AND organization.demo_expires_at > now()
        ) AS active
      `,
      [hashDemoSessionToken(token)],
    );

    response.json({
      ok: true,
      enabled: true,
      active: result.rows[0]?.active ?? false,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      ok: false,
      error: "Unable to read the private demo session.",
    });
  }
});

demoSessionRouter.post("/", async (request, response) => {
  if (!env.DEMO_SESSIONS_ENABLED) {
    response.json({
      ok: true,
      local: true,
    });
    return;
  }

  const existingToken = readDemoSessionToken(request.headers.cookie);

  if (existingToken) {
    try {
      const existing = await pool.query<{
        organizationId: string;
        expiresAt: Date;
      }>(
        `
          SELECT
            organization.id AS "organizationId",
            demo_session.expires_at AS "expiresAt"
          FROM demo_sessions demo_session
          JOIN organizations organization
            ON organization.id = demo_session.organization_id
          WHERE demo_session.token_hash = $1
            AND demo_session.expires_at > now()
            AND organization.is_demo = true
            AND organization.demo_expires_at > now()
          LIMIT 1
        `,
        [hashDemoSessionToken(existingToken)],
      );
      const active = existing.rows[0];

      if (active) {
        response.setHeader(
          "Set-Cookie",
          createDemoSessionCookie(existingToken),
        );
        response.json({
          ok: true,
          workspace: {
            id: active.organizationId,
            expiresAt: active.expiresAt.toISOString(),
          },
        });
        return;
      }
    } catch (error) {
      console.error("Unable to reuse the existing demo session.", error);
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const demo = await createPrivateDemoWorkspace(client);
    await client.query("COMMIT");

    response.setHeader("Set-Cookie", createDemoSessionCookie(demo.token));
    response.status(201).json({
      ok: true,
      workspace: {
        id: demo.organizationId,
        expiresAt: demo.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    response.status(500).json({
      ok: false,
      error: "Unable to start a private Vizow demo.",
    });
  } finally {
    client.release();
  }
});

demoSessionRouter.post(
  "/reset",
  requireOrganizationScope,
  async (_request, response) => {
    const sessionId = getDemoSessionId();

    if (!sessionId) {
      response.status(401).json({
        ok: false,
        error: "A private demo session is required.",
      });
      return;
    }

    const token = readDemoSessionToken(_request.headers.cookie);

    if (!token) {
      response.status(401).json({
        ok: false,
        error: "A private demo session is required.",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const demo = await replacePrivateDemoWorkspace(client, sessionId, token);
      await client.query("COMMIT");

      response.setHeader("Set-Cookie", createDemoSessionCookie(demo.token));
      response.json({
        ok: true,
        workspace: {
          id: demo.organizationId,
          expiresAt: demo.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);
      response.status(500).json({
        ok: false,
        error: "Unable to reset this Vizow demo.",
      });
    } finally {
      client.release();
    }
  },
);
