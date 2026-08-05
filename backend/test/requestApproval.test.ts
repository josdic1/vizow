import type { Express } from "express";
import request from "supertest";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const database = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn(async () => ({
    query,
    release,
  }));

  return {
    connect,
    end: vi.fn(),
    query,
    release,
  };
});

vi.mock("../src/db/pool.js", () => ({
  pool: {
    connect: database.connect,
    end: database.end,
    query: vi.fn(),
  },
}));

let app: Express;

const organizationId = "00000000-0000-4000-8000-000000000001";
const clientId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const jobId = "00000000-0000-4000-8000-000000000004";
const cycleId = "00000000-0000-4000-8000-000000000005";
const now = new Date("2026-08-05T12:00:00.000Z");

beforeAll(async () => {
  process.env.DATABASE_URL =
    "postgresql://vizow_test:vizow_test@localhost:5432/vizow_test";
  process.env.ORGANIZATION_SLUG = "test-organization";
  process.env.CLOUDINARY_CLOUD_NAME = "test";
  process.env.CLOUDINARY_API_KEY = "test";
  process.env.CLOUDINARY_API_SECRET = "test";
  process.env.CLOUDINARY_FOLDER = "test";

  ({ app } = await import("../src/app.js"));
});

beforeEach(() => {
  database.connect.mockClear();
  database.query.mockReset();
  database.release.mockClear();

  database.query.mockImplementation(async (sql: string) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [] };
    }

    if (sql.includes("FROM requests work_request")) {
      return {
        rows: [{
          organizationId,
          id: requestId,
          clientId,
          clientName: "Jamie Whitfield",
          title: "Repair roof leak",
          description: "Water near the chimney.",
          serviceAddressLine1: "482 Maple Street",
          serviceAddressLine2: null,
          serviceCity: "South Orange",
          serviceState: "NJ",
          servicePostalCode: "07079",
          status: "open",
          approvedJobId: null,
          submittedAt: now,
          decidedAt: null,
          createdAt: now,
          updatedAt: now,
        }],
      };
    }

    if (sql.includes("INSERT INTO jobs")) {
      return {
        rows: [{
          id: jobId,
          clientId,
          title: "Repair roof leak",
          description: "Water near the chimney.",
          serviceAddressLine1: "482 Maple Street",
          serviceAddressLine2: null,
          serviceCity: "South Orange",
          serviceState: "NJ",
          servicePostalCode: "07079",
          lifecycleStatus: "active",
          cancelledAt: null,
          cancellationReason: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        }],
      };
    }

    if (sql.includes("INSERT INTO job_cycles")) {
      return {
        rows: [{
          cycleId,
          cycleNumber: 1,
          cycleReason: "original",
          cycleStage: "project",
          cycleOpenedAt: now,
          cycleCompletedAt: null,
          cycleCreatedAt: now,
          cycleUpdatedAt: now,
        }],
      };
    }

    if (sql.includes("UPDATE requests")) {
      return {
        rows: [{
          id: requestId,
          clientId,
          title: "Repair roof leak",
          description: "Water near the chimney.",
          serviceAddressLine1: "482 Maple Street",
          serviceAddressLine2: null,
          serviceCity: "South Orange",
          serviceState: "NJ",
          servicePostalCode: "07079",
          status: "approved",
          approvedJobId: jobId,
          submittedAt: now,
          decidedAt: now,
          createdAt: now,
          updatedAt: now,
        }],
      };
    }

    if (
      sql.includes("INSERT INTO request_events") ||
      sql.includes("INSERT INTO job_events")
    ) {
      return { rows: [] };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
});

describe("POST /api/requests/:requestId/approve", () => {
  it("returns the committed Job with its complete lifecycle state", async () => {
    const response = await request(app)
      .post(`/api/requests/${requestId}/approve`)
      .send({})
      .expect(201);

    expect(response.body).toMatchObject({
      ok: true,
      request: {
        id: requestId,
        status: "approved",
        approvedJobId: jobId,
      },
      job: {
        id: jobId,
        lifecycleStatus: "active",
        cancelledAt: null,
        cancellationReason: null,
        archivedAt: null,
        currentCycle: {
          id: cycleId,
          cycleNumber: 1,
          reason: "original",
          stage: "project",
        },
      },
    });

    const transactionCommands = database.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql) =>
        sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK"
      );

    expect(transactionCommands).toEqual(["BEGIN", "COMMIT"]);
    expect(database.release).toHaveBeenCalledOnce();
  });
});
