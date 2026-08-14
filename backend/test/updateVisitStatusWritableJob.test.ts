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
const reopenedCycleId = "00000000-0000-4000-8000-000000000005";
let lifecycleStatus: "active" | "cancelled";
let archivedAt: Date | null;
let currentCycleStage: "open" | "completed";
let currentCycleId: string;
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
  currentCycleStage = "open";
  currentCycleId = cycleId;
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

    if (sql.includes("FROM visits visit")) {
      return {
        rows: [{
          organizationId,
          jobCycleId: cycleId,
          cycleNumber: 1,
          status: "scheduled",
          lifecycleStatus,
          archivedAt,
          currentCycleId,
          currentCycleStage,
        }],
      };
    }

    if (sql.includes("UPDATE visits")) {
      return {
        rows: [{
          id: visitId,
          jobId,
          jobCycleId: cycleId,
          status: "completed",
          scheduledStart: new Date("2026-08-06T13:00:00.000Z"),
          scheduledEnd: null,
          notes: null,
          createdAt,
          updatedAt: new Date("2026-08-05T14:15:00.000Z"),
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

async function completeVisit(): Promise<request.Response> {
  return request(app)
    .patch(`/api/jobs/${jobId}/visits/${visitId}/status`)
    .send({ status: "completed" });
}

function expectNoVisitUpdate(): void {
  const sqlStatements = database.query.mock.calls.map(
    ([sql]) => sql,
  );

  expect(
    sqlStatements.find((sql) =>
      sql.includes("FROM visits visit"),
    ),
  ).toContain("FOR UPDATE OF job, current_cycle, visit");

  expect(sqlStatements).not.toEqual(
    expect.arrayContaining([
      expect.stringContaining("UPDATE visits"),
    ]),
  );
}

describe("PATCH /api/jobs/:jobId/visits/:visitId/status writable Job guard", () => {
  it("rejects a cancelled Job before updating the Visit", async () => {
    lifecycleStatus = "cancelled";

    const response = await completeVisit();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Cancelled Jobs cannot be modified.",
    );
    expectNoVisitUpdate();
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects an archived Job before updating the Visit", async () => {
    archivedAt = new Date("2026-08-05T14:00:00.000Z");

    const response = await completeVisit();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Archived Jobs cannot be modified.",
    );
    expectNoVisitUpdate();
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects a completed current cycle before updating the Visit", async () => {
    currentCycleStage = "completed";

    const response = await completeVisit();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Visit status can only be updated during an active work cycle.",
    );
    expectNoVisitUpdate();
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects a Visit from an older cycle after the Job is reopened", async () => {
    currentCycleId = reopenedCycleId;

    const response = await completeVisit();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Only Visits in the current work cycle can be modified.",
    );
    expectNoVisitUpdate();
    expect(database.release).toHaveBeenCalledOnce();
  });
});

describe("PATCH /api/jobs/:jobId/visits/:visitId/status commit boundary", () => {
  it("builds a valid response before committing", async () => {
    const response = await completeVisit();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      visit: {
        id: visitId,
        jobId,
        jobCycleId: cycleId,
        cycleNumber: 1,
        status: "completed",
        scheduledStart: "2026-08-06T13:00:00.000Z",
        scheduledEnd: null,
        notes: null,
        linkedScopeRevisions: [],
        createdAt: "2026-08-05T14:00:00.000Z",
        updatedAt: "2026-08-05T14:15:00.000Z",
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
      const response = await completeVisit();

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
      const response = await completeVisit();

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
