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
let currentCycleStage: "project" | "completed";

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
  currentCycleStage = "project";
  database.connect.mockClear();
  database.query.mockReset();
  database.release.mockClear();

  database.query.mockImplementation(async (sql: string) => {
    if (sql === "BEGIN" || sql === "ROLLBACK") {
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
          currentCycleStage,
        }],
      };
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
});
