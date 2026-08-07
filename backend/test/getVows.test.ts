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

const database = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
}));

vi.mock("../src/db/pool.js", () => ({
  pool: database,
}));

let app: Express;

const clientId = "00000000-0000-4000-8000-000000000001";
const jobId = "00000000-0000-4000-8000-000000000002";
const cycleId = "00000000-0000-4000-8000-000000000003";
const vowId = "00000000-0000-4000-8000-000000000004";

const snapshot = {
  client: {
    id: clientId,
    name: "VOW Client",
  },
  job: {
    id: jobId,
    title: "Visible Job",
    serviceAddressLine1: "1 Test Way",
    serviceAddressLine2: null,
    serviceCity: "Testville",
    serviceState: "NJ",
    servicePostalCode: "07000",
  },
  cycle: {
    id: cycleId,
    cycleNumber: 2,
    openedAt: "2026-08-05T12:00:00.000Z",
    completedAt: "2026-08-05T14:00:00.000Z",
  },
  fieldNotes: [],
  media: [],
};

const vowRow = {
  id: vowId,
  clientId,
  title: "Visible Job · Cycle 2",
  status: "draft",
  snapshot,
  publishedAt: null,
  createdAt: new Date("2026-08-05T14:30:00.000Z"),
  updatedAt: new Date("2026-08-05T14:30:00.000Z"),
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
  database.query.mockReset();
});

describe("VOW retrieval", () => {
  it("lists VOW snapshots for the organization and optional Job", async () => {
    database.query.mockResolvedValue({ rows: [vowRow] });

    const response = await request(app)
      .get(`/api/vows?jobId=${jobId}`)
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      vows: [{
        ...vowRow,
        createdAt: vowRow.createdAt.toISOString(),
        updatedAt: vowRow.updatedAt.toISOString(),
      }],
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("vow_job.job_id = $2"),
      ["test-organization", jobId],
    );
  });

  it("loads one VOW snapshot by ID", async () => {
    database.query.mockResolvedValue({ rows: [vowRow] });

    const response = await request(app)
      .get(`/api/vows/${vowId}`)
      .expect(200);

    expect(response.body.vow.id).toBe(vowId);
    expect(response.body.vow.snapshot.cycle.cycleNumber).toBe(2);
  });

  it("returns 404 when the VOW is outside the organization or missing", async () => {
    database.query.mockResolvedValue({ rows: [] });

    await request(app)
      .get(`/api/vows/${vowId}`)
      .expect(404, {
        ok: false,
        error: "VOW was not found.",
      });
  });

  it("rejects malformed IDs before querying PostgreSQL", async () => {
    await request(app)
      .get("/api/vows?jobId=not-a-uuid")
      .expect(400, {
        ok: false,
        error: "Invalid job ID.",
      });

    expect(database.query).not.toHaveBeenCalled();
  });
});
