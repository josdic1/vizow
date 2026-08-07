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

const jobId = "00000000-0000-4000-8000-000000000001";
const cycleId = "00000000-0000-4000-8000-000000000002";
const mediaId = "00000000-0000-4000-8000-000000000003";

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

describe("GET /api/jobs/:jobId/photos", () => {
  it("lists saved photos for the Job", async () => {
    database.query.mockResolvedValue({
      rows: [{
        id: mediaId,
        jobId,
        jobCycleId: cycleId,
        url: "https://example.com/photo.jpg",
        storageKey: "vizow/photo",
        mimeType: "image/jpeg",
        stage: "before",
        caption: null,
        capturedAt: new Date("2026-08-07T12:00:00.000Z"),
        createdAt: new Date("2026-08-07T12:00:00.000Z"),
      }],
    });

    const response = await request(app)
      .get(`/api/jobs/${jobId}/photos`)
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      media: [{
        id: mediaId,
        jobId,
        jobCycleId: cycleId,
        url: "https://example.com/photo.jpg",
        storageKey: "vizow/photo",
        mimeType: "image/jpeg",
        stage: "before",
        caption: null,
        capturedAt: "2026-08-07T12:00:00.000Z",
        createdAt: "2026-08-07T12:00:00.000Z",
      }],
    });

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("media.job_id = $2"),
      ["test-organization", jobId],
    );
  });

  it("rejects malformed Job IDs before querying PostgreSQL", async () => {
    await request(app)
      .get("/api/jobs/not-a-uuid/photos")
      .expect(400, {
        ok: false,
        error: "Invalid job ID.",
      });

    expect(database.query).not.toHaveBeenCalled();
  });
});
