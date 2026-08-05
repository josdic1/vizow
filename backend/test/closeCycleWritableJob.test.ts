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
let lifecycleStatus: "active" | "cancelled";
let archivedAt: Date | null;
let stage: "project" | "completed";

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
  stage = "project";
  database.connect.mockClear();
  database.query.mockReset();
  database.release.mockClear();

  database.query.mockImplementation(async (sql: string) => {
    if (sql === "BEGIN" || sql === "ROLLBACK") {
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
          stage,
        }],
      };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
});

async function closeCycle(): Promise<request.Response> {
  return request(app)
    .post(`/api/jobs/${jobId}/close-cycle`)
    .send({
      finalPrice: null,
      notes: null,
      confirmScopeVisitWarnings: false,
    });
}

function expectNoClosureInsert(): void {
  const sqlStatements = database.query.mock.calls.map(
    ([sql]) => sql,
  );

  expect(
    sqlStatements.find((sql) =>
      sql.includes("FROM jobs job"),
    ),
  ).toContain("FOR UPDATE OF job, cycle");

  expect(sqlStatements).not.toEqual(
    expect.arrayContaining([
      expect.stringContaining("INSERT INTO closures"),
    ]),
  );
}

describe("POST /api/jobs/:jobId/close-cycle writable Job guard", () => {
  it("rejects a cancelled Job before inserting a Closure", async () => {
    lifecycleStatus = "cancelled";

    const response = await closeCycle();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Cancelled Jobs cannot be modified.",
    );
    expectNoClosureInsert();
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects an archived Job before inserting a Closure", async () => {
    archivedAt = new Date("2026-08-05T14:00:00.000Z");

    const response = await closeCycle();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "Archived Jobs cannot be modified.",
    );
    expectNoClosureInsert();
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects an already completed current cycle", async () => {
    stage = "completed";

    const response = await closeCycle();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "The current work cycle is already closed.",
    );
    expectNoClosureInsert();
    expect(database.release).toHaveBeenCalledOnce();
  });
});
