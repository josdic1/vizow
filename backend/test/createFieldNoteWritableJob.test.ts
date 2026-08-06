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
const fieldNoteId = "00000000-0000-4000-8000-000000000004";
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
          lifecycleStatus,
          archivedAt,
          stage: "project",
        }],
      };
    }

    if (sql.includes("INSERT INTO field_notes")) {
      return {
        rows: [{
          id: fieldNoteId,
          jobId,
          jobCycleId: cycleId,
          mediaId: null,
          content: "Roof decking is dry after the repair.",
          capturedAt: new Date("2026-08-05T14:00:00.000Z"),
          createdAt,
        }],
      };
    }

    if (sql.includes("INSERT INTO job_events")) {
      return { rows: [] };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
});

async function createFieldNote(): Promise<request.Response> {
  return request(app)
    .post(`/api/jobs/${jobId}/field-notes`)
    .send({
      content: "Roof decking is dry after the repair.",
    });
}

function expectNoFieldNoteInsert(): void {
  const sqlStatements = database.query.mock.calls.map(
    ([sql]) => sql,
  );

  expect(
    sqlStatements.find((sql) =>
      sql.includes("FROM jobs job"),
    ),
  ).toContain("FOR UPDATE OF job, cycle");

  expect(
    sqlStatements,
  ).not.toEqual(
    expect.arrayContaining([
      expect.stringContaining("INSERT INTO field_notes"),
    ]),
  );
}

describe("POST /api/jobs/:jobId/field-notes writable Job guard", () => {
  it("rejects a cancelled Job before inserting a Field Note", async () => {
    lifecycleStatus = "cancelled";

    const response = await createFieldNote();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: "Cancelled Jobs cannot be modified.",
    });
    expectNoFieldNoteInsert();
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects an archived Job before inserting a Field Note", async () => {
    archivedAt = new Date("2026-08-05T14:00:00.000Z");

    const response = await createFieldNote();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: "Archived Jobs cannot be modified.",
    });
    expectNoFieldNoteInsert();
    expect(database.release).toHaveBeenCalledOnce();
  });
});

describe("POST /api/jobs/:jobId/field-notes commit boundary", () => {
  it("builds a valid response before committing", async () => {
    const response = await createFieldNote();

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ok: true,
      fieldNote: {
        id: fieldNoteId,
        jobId,
        jobCycleId: cycleId,
        mediaId: null,
        content: "Roof decking is dry after the repair.",
        capturedAt: "2026-08-05T14:00:00.000Z",
        createdAt: "2026-08-05T14:00:00.000Z",
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
      const response = await createFieldNote();

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
      const response = await createFieldNote();

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
