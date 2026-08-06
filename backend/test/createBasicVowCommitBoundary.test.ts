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
const clientId = "00000000-0000-4000-8000-000000000002";
const jobId = "00000000-0000-4000-8000-000000000003";
const cycleId = "00000000-0000-4000-8000-000000000004";
const vowId = "00000000-0000-4000-8000-000000000005";
const fieldNoteId = "00000000-0000-4000-8000-000000000006";
const completedAt = new Date("2026-08-05T14:00:00.000Z");

type VowPath = "existing" | "create";

let vowPath: VowPath;
let vowCreatedAt: Date;

const snapshot = {
  client: {
    id: clientId,
    name: "VOW Test Client",
  },
  job: {
    id: jobId,
    title: "VOW Test Job",
    serviceAddressLine1: "1 Test Way",
    serviceAddressLine2: null,
    serviceCity: "Testville",
    serviceState: "NJ",
    servicePostalCode: "07000",
  },
  cycle: {
    id: cycleId,
    cycleNumber: 1,
    openedAt: "2026-08-05T12:00:00.000Z",
    completedAt: completedAt.toISOString(),
  },
  fieldNotes: [],
  media: [],
};

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
  vowPath = "existing";
  vowCreatedAt = new Date("2026-08-05T14:30:00.000Z");
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
          clientId,
          clientName: "VOW Test Client",
          jobId,
          jobTitle: "VOW Test Job",
          serviceAddressLine1: "1 Test Way",
          serviceAddressLine2: null,
          serviceCity: "Testville",
          serviceState: "NJ",
          servicePostalCode: "07000",
          jobCycleId: cycleId,
          cycleNumber: 1,
          stage: "completed",
          openedAt: new Date("2026-08-05T12:00:00.000Z"),
          completedAt,
        }],
      };
    }

    if (
      sql.includes("FROM vows vow") &&
      sql.includes("JOIN vow_jobs vow_job")
    ) {
      return {
        rows: vowPath === "existing"
          ? [{
              id: vowId,
              clientId,
              title: "VOW Test Job · Cycle 1",
              status: "draft",
              snapshot,
              publishedAt: null,
              createdAt: vowCreatedAt,
              updatedAt: new Date("2026-08-05T14:30:00.000Z"),
            }]
          : [],
      };
    }

    if (sql.includes("FROM field_notes note")) {
      return {
        rows: [{
          id: fieldNoteId,
          jobId,
          jobCycleId: cycleId,
          mediaId: null,
          content: "Completed the work.",
          capturedAt: new Date("2026-08-05T13:30:00.000Z"),
          createdAt: new Date("2026-08-05T13:30:00.000Z"),
        }],
      };
    }

    if (sql.includes("FROM media")) {
      return { rows: [] };
    }

    if (sql.includes("INSERT INTO vows")) {
      return {
        rows: [{
          id: vowId,
          clientId,
          title: "VOW Test Job · Cycle 1",
          status: "draft",
          snapshot: {
            ...snapshot,
            fieldNotes: [{
              id: fieldNoteId,
              jobId,
              jobCycleId: cycleId,
              mediaId: null,
              content: "Completed the work.",
              capturedAt: "2026-08-05T13:30:00.000Z",
              createdAt: "2026-08-05T13:30:00.000Z",
            }],
          },
          publishedAt: null,
          createdAt: vowCreatedAt,
          updatedAt: new Date("2026-08-05T14:30:00.000Z"),
        }],
      };
    }

    if (
      sql.includes("INSERT INTO vow_jobs") ||
      sql.includes("INSERT INTO job_events")
    ) {
      return { rows: [] };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
});

async function generateVow(): Promise<request.Response> {
  return request(app)
    .post(`/api/jobs/${jobId}/basic-vow`)
    .send({});
}

function expectCommittedWithoutRollback(): void {
  const sqlStatements = database.query.mock.calls.map(
    ([sql]) => sql,
  );

  expect(sqlStatements).toContain("COMMIT");
  expect(sqlStatements).not.toContain("ROLLBACK");
}

describe("POST /api/jobs/:jobId/basic-vow commit boundary", () => {
  it("does not issue a false rollback when delivery of an existing VOW fails after commit", async () => {
    const responseJson = vi
      .spyOn(expressResponse, "json")
      .mockImplementationOnce(() => {
        throw new Error("Simulated response delivery failure.");
      });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await generateVow();

      expect(response.status).toBe(500);
      expectCommittedWithoutRollback();
      expect(database.release).toHaveBeenCalledOnce();
    } finally {
      responseJson.mockRestore();
      consoleError.mockRestore();
    }
  });

  it("does not issue a false rollback when delivery of a new VOW fails after commit", async () => {
    vowPath = "create";
    const responseJson = vi
      .spyOn(expressResponse, "json")
      .mockImplementationOnce(() => {
        throw new Error("Simulated response delivery failure.");
      });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await generateVow();

      expect(response.status).toBe(500);
      expectCommittedWithoutRollback();
      expect(database.release).toHaveBeenCalledOnce();
    } finally {
      responseJson.mockRestore();
      consoleError.mockRestore();
    }
  });

  it("rolls back when response construction fails before commit", async () => {
    vowCreatedAt = new Date("invalid");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await generateVow();

      expect(response.status).toBe(500);

      const sqlStatements = database.query.mock.calls.map(
        ([sql]) => sql,
      );

      expect(sqlStatements).not.toContain("COMMIT");
      expect(sqlStatements).toContain("ROLLBACK");
      expect(database.release).toHaveBeenCalledOnce();
    } finally {
      consoleError.mockRestore();
    }
  });
});
