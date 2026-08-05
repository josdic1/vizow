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
  database.query.mockResolvedValue({ rows: [] });
});

describe("GET /api/jobs archive filtering", () => {
  it("excludes archived Jobs by default", async () => {
    await request(app)
      .get("/api/jobs")
      .expect(200, {
        ok: true,
        jobs: [],
      });

    const [sql] = database.query.mock.calls[0] ?? [];

    expect(sql).toContain("AND j.archived_at IS NULL");
  });

  it("includes archived Jobs only when explicitly requested", async () => {
    await request(app)
      .get("/api/jobs?includeArchived=true")
      .expect(200, {
        ok: true,
        jobs: [],
      });

    const [sql] = database.query.mock.calls[0] ?? [];

    expect(sql).not.toContain("AND j.archived_at IS NULL");
  });
});
