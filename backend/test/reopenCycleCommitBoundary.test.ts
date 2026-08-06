import {
  response as expressResponse,
  type Express,
} from "express";
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
  const connect = vi.fn(async () => ({ query, release }));

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
const jobId = "00000000-0000-4000-8000-000000000002";
const previousCycleId = "00000000-0000-4000-8000-000000000003";
const newCycleId = "00000000-0000-4000-8000-000000000004";
const clientId = "00000000-0000-4000-8000-000000000005";
let reopenedAt: Date;

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
  reopenedAt = new Date("2026-08-06T14:00:00.000Z");
  database.connect.mockClear();
  database.query.mockReset();
  database.release.mockClear();

  database.query.mockImplementation(async (sql: string) => {
    if (
      sql === "BEGIN" ||
      sql === "COMMIT" ||
      sql === "ROLLBACK"
    ) {
      return { rows: [] };
    }

    if (
      sql.includes("FROM jobs job") &&
      sql.includes("FOR UPDATE OF job")
    ) {
      return {
        rows: [{
          organizationId,
          lifecycleStatus: "active",
          archivedAt: null,
        }],
      };
    }

    if (sql.includes("FROM job_cycles cycle")) {
      return {
        rows: [{
          jobCycleId: previousCycleId,
          cycleNumber: 1,
          stage: "completed",
        }],
      };
    }

    if (sql.includes("INSERT INTO job_cycles")) {
      return { rows: [{ id: newCycleId }] };
    }

    if (
      sql.includes("UPDATE jobs") ||
      sql.includes("INSERT INTO job_events")
    ) {
      return { rows: [] };
    }

    if (
      sql.includes("FROM jobs j") &&
      sql.includes("JOIN current_job_cycles cycle")
    ) {
      const createdAt = new Date("2026-08-05T13:00:00.000Z");

      return {
        rows: [{
          id: jobId,
          clientId,
          clientName: "Casey Morgan",
          title: "Replace damaged roof decking",
          description: null,
          serviceAddressLine1: "47 Main Street",
          serviceAddressLine2: null,
          serviceCity: "Bloomingdale",
          serviceState: "NJ",
          servicePostalCode: "07403",
          lifecycleStatus: "active",
          cancelledAt: null,
          cancellationReason: null,
          archivedAt: null,
          createdAt,
          updatedAt: reopenedAt,
          cycleId: newCycleId,
          cycleNumber: 2,
          cycleReason: "reopened",
          cycleStage: "project",
          cycleOpenedAt: reopenedAt,
          cycleCompletedAt: null,
          cycleCreatedAt: reopenedAt,
          cycleUpdatedAt: reopenedAt,
        }],
      };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
});

async function reopenCycle(): Promise<request.Response> {
  return request(app)
    .post(`/api/jobs/${jobId}/reopen-cycle`)
    .send({});
}

describe("POST /api/jobs/:jobId/reopen-cycle commit boundary", () => {
  it("builds a valid response before committing", async () => {
    const response = await reopenCycle();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ok: true,
      job: {
        id: jobId,
        lifecycleStatus: "active",
        archivedAt: null,
        currentCycle: {
          id: newCycleId,
          cycleNumber: 2,
          reason: "reopened",
          stage: "project",
          completedAt: null,
        },
      },
    });

    const sqlStatements = database.query.mock.calls.map(
      ([sql]) => sql,
    );

    expect(sqlStatements).toContain("COMMIT");
    expect(sqlStatements).not.toContain("ROLLBACK");
  });

  it("rolls back when response construction fails before commit", async () => {
    reopenedAt = new Date("invalid");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await reopenCycle();

      expect(response.status).toBe(500);

      const sqlStatements = database.query.mock.calls.map(
        ([sql]) => sql,
      );

      expect(sqlStatements).not.toContain("COMMIT");
      expect(sqlStatements).toContain("ROLLBACK");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not issue a false rollback when response delivery fails after commit", async () => {
    const responseJson = vi
      .spyOn(expressResponse, "json")
      .mockImplementationOnce(() => {
        throw new Error("Simulated response delivery failure.");
      });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await reopenCycle();

      expect(response.status).toBe(500);

      const sqlStatements = database.query.mock.calls.map(
        ([sql]) => sql,
      );

      expect(sqlStatements).toContain("COMMIT");
      expect(sqlStatements).not.toContain("ROLLBACK");
      expect(database.release).toHaveBeenCalledOnce();
    } finally {
      responseJson.mockRestore();
      consoleError.mockRestore();
    }
  });
});
