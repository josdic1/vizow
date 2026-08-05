import { randomUUID } from "node:crypto";

import { approveRequestResponseSchema } from "@vizow/shared";
import type { Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

let app: Express | undefined;
let pool: Pool | undefined;
const testOrganizationSlug = `test-organization-${randomUUID()}`;

beforeAll(async () => {
  process.env.DATABASE_URL ??=
    "postgresql://vizow_test:vizow_test@localhost:5432/vizow_test";

  process.env.ORGANIZATION_SLUG = testOrganizationSlug;
  process.env.CLOUDINARY_CLOUD_NAME ??= "test-cloud";
  process.env.CLOUDINARY_API_KEY ??= "test-key";
  process.env.CLOUDINARY_API_SECRET ??= "test-secret";
  process.env.CLOUDINARY_FOLDER ??= "vizow-test";

  ({ app } = await import("../src/app.js"));
  ({ pool } = await import("../src/db/pool.js"));
});

afterAll(async () => {
  await pool?.end();
});

describe("Vizow API", () => {
  it("reports that the server is healthy", async () => {
    const response = await request(app)
      .get("/health")
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      app: "vizow",
    });
  });

  it("does not expose the removed operations API", async () => {
    await request(app)
      .get("/api/operations/example")
      .expect(404);
  });

  it("approves a Request exactly once and returns the created Job", async () => {
    if (!pool) {
      throw new Error("The test database pool is unavailable.");
    }

    const organizationId = randomUUID();
    const clientId = randomUUID();
    const requestId = randomUUID();
    let organizationCreated = false;

    try {
      await pool.query(
        `
          INSERT INTO organizations (id, name, slug)
          VALUES ($1, $2, $3)
        `,
        [organizationId, "Test Organization", testOrganizationSlug],
      );
      organizationCreated = true;

      await pool.query(
        `
          INSERT INTO clients (
            id,
            organization_id,
            name
          )
          VALUES ($1, $2, $3)
        `,
        [clientId, organizationId, "Approval Test Client"],
      );

      await pool.query(
        `
          INSERT INTO requests (
            id,
            organization_id,
            client_id,
            title,
            description,
            service_address_line_1,
            service_city,
            service_state,
            service_postal_code
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          requestId,
          organizationId,
          clientId,
          "Approval Test Job",
          "Confirm approval transaction integrity.",
          "1 Test Way",
          "Testville",
          "NJ",
          "07000",
        ],
      );

      const approvalResponse = await request(app)
        .post(`/api/requests/${requestId}/approve`)
        .send({})
        .expect(201);

      const approval = approveRequestResponseSchema.parse(
        approvalResponse.body,
      );

      expect(approval.request.status).toBe("approved");
      expect(approval.request.approvedJobId).toBe(approval.job.id);
      expect(approval.job.lifecycleStatus).toBe("active");
      expect(approval.job.cancelledAt).toBeNull();
      expect(approval.job.cancellationReason).toBeNull();
      expect(approval.job.archivedAt).toBeNull();
      expect(approval.job.currentCycle.cycleNumber).toBe(1);
      expect(approval.job.currentCycle.reason).toBe("original");
      expect(approval.job.currentCycle.stage).toBe("project");

      const persistedResult = await pool.query<{
        jobCount: number;
        cycleCount: number;
        requestEventCount: number;
        jobEventCount: number;
      }>(
        `
          SELECT
            (
              SELECT COUNT(*)::integer
              FROM jobs
              WHERE organization_id = $1
                AND client_id = $2
            ) AS "jobCount",
            (
              SELECT COUNT(*)::integer
              FROM job_cycles
              WHERE organization_id = $1
            ) AS "cycleCount",
            (
              SELECT COUNT(*)::integer
              FROM request_events
              WHERE organization_id = $1
                AND request_id = $3
                AND event_type = 'request_approved'
            ) AS "requestEventCount",
            (
              SELECT COUNT(*)::integer
              FROM job_events
              WHERE organization_id = $1
                AND event_type = 'request_approved'
            ) AS "jobEventCount"
        `,
        [organizationId, clientId, requestId],
      );

      expect(persistedResult.rows[0]).toEqual({
        jobCount: 1,
        cycleCount: 1,
        requestEventCount: 1,
        jobEventCount: 1,
      });

      const retryResponse = await request(app)
        .post(`/api/requests/${requestId}/approve`)
        .send({})
        .expect(409);

      expect(retryResponse.body).toMatchObject({
        ok: false,
        error: "Request has already been approved.",
        approvedJobId: approval.job.id,
      });

      const jobCountAfterRetry = await pool.query<{
        count: number;
      }>(
        `
          SELECT COUNT(*)::integer AS count
          FROM jobs
          WHERE organization_id = $1
            AND client_id = $2
        `,
        [organizationId, clientId],
      );

      expect(jobCountAfterRetry.rows[0]?.count).toBe(1);
    } finally {
      if (organizationCreated) {
        const cleanupQueries = [
          "DELETE FROM job_events WHERE organization_id = $1",
          "DELETE FROM request_events WHERE organization_id = $1",
          "DELETE FROM job_cycles WHERE organization_id = $1",
          "DELETE FROM requests WHERE organization_id = $1",
          "DELETE FROM jobs WHERE organization_id = $1",
          "DELETE FROM clients WHERE organization_id = $1",
          "DELETE FROM organizations WHERE id = $1",
        ];

        for (const cleanupQuery of cleanupQueries) {
          await pool.query(cleanupQuery, [organizationId]);
        }
      }
    }
  });
});
