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
const cycleId = "00000000-0000-4000-8000-000000000003";
const visitId = "00000000-0000-4000-8000-000000000004";
let lifecycleStatus: "active" | "cancelled";
let archivedAt: Date | null;
let createdAt: Date;

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
  lifecycleStatus = "active";
  archivedAt = null;
  createdAt = new Date("2026-08-05T14:00:00.000Z");
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
      sql.includes("JOIN job_cycles cycle")
    ) {
      return {
        rows: [{
          organizationId,
          jobCycleId: cycleId,
          cycleNumber: 1,
          lifecycleStatus,
          archivedAt,
          stage: "open",
        }],
      };
    }

    if (sql.includes("INSERT INTO visits")) {
      return {
        rows: [{
          id: visitId,
          jobId,
          jobCycleId: cycleId,
          status: "scheduled",
          scheduledStart: new Date("2026-08-06T13:00:00.000Z"),
          scheduledEnd: null,
          notes: null,
          createdAt,
          updatedAt: new Date("2026-08-05T14:00:00.000Z"),
        }],
      };
    }

    if (
      sql.includes("INSERT INTO job_events") ||
      sql.includes("UPDATE jobs")
    ) {
      return { rows: [] };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
});

async function scheduleVisit(): Promise<request.Response> {
  return request(app)
    .post(`/api/jobs/${jobId}/visits`)
    .send({
      scheduledStart: "2026-08-06T13:00:00.000Z",
      scheduledEnd: null,
      notes: null,
    });
}

describe("POST /api/jobs/:jobId/visits writable Job guard", () => {
  it("rejects a cancelled Job before inserting a Visit", async () => {
    lifecycleStatus = "cancelled";

    const response = await scheduleVisit();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: "Cancelled Jobs cannot be modified.",
    });
    expect(
      database.query.mock.calls.map(([sql]) => sql),
    ).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("INSERT INTO visits"),
      ]),
    );
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects an archived Job before inserting a Visit", async () => {
    archivedAt = new Date("2026-08-05T14:00:00.000Z");

    const response = await scheduleVisit();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: "Archived Jobs cannot be modified.",
    });
    expect(
      database.query.mock.calls.map(([sql]) => sql),
    ).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("INSERT INTO visits"),
      ]),
    );
    expect(database.release).toHaveBeenCalledOnce();
  });
});

describe("POST /api/jobs/:jobId/visits commit boundary", () => {
  it("builds a valid response before committing", async () => {
    const response = await scheduleVisit();

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ok: true,
      visit: {
        id: visitId,
        jobId,
        jobCycleId: cycleId,
        cycleNumber: 1,
        status: "scheduled",
        scheduledStart: "2026-08-06T13:00:00.000Z",
        scheduledEnd: null,
        notes: null,
        linkedScopeRevisions: [],
        createdAt: "2026-08-05T14:00:00.000Z",
        updatedAt: "2026-08-05T14:00:00.000Z",
      },
    });

    const sqlStatements = database.query.mock.calls.map(
      ([sql]) => sql,
    );

    expect(sqlStatements).toContain("COMMIT");
    expect(sqlStatements).not.toContain("ROLLBACK");
  });

  it("rolls back when response construction fails before commit", async () => {
    createdAt = new Date("invalid");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await scheduleVisit();

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
      const response = await scheduleVisit();

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
