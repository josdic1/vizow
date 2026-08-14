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
const firstEventId = "00000000-0000-4000-8000-000000000003";
const secondEventId = "00000000-0000-4000-8000-000000000004";

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

describe("GET /api/jobs/:jobId/journey", () => {
  it("returns Job events in chronological order", async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [{ id: jobId }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: firstEventId,
            jobId,
            jobCycleId: cycleId,
            eventType: "request_approved",
            details: {
              requestId:
                "00000000-0000-4000-8000-000000000010",
            },
            createdAt: new Date(
              "2026-08-01T12:00:00.000Z",
            ),
          },
          {
            id: secondEventId,
            jobId,
            jobCycleId: cycleId,
            eventType: "photo_uploaded",
            details: {
              mediaId:
                "00000000-0000-4000-8000-000000000011",
              stage: "before",
            },
            createdAt: new Date(
              "2026-08-02T12:00:00.000Z",
            ),
          },
        ],
      });

    const response = await request(app)
      .get(`/api/jobs/${jobId}/journey`)
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      events: [
        {
          id: firstEventId,
          jobId,
          jobCycleId: cycleId,
          eventType: "request_approved",
          details: {
            requestId:
              "00000000-0000-4000-8000-000000000010",
          },
          createdAt: "2026-08-01T12:00:00.000Z",
        },
        {
          id: secondEventId,
          jobId,
          jobCycleId: cycleId,
          eventType: "photo_uploaded",
          details: {
            mediaId:
              "00000000-0000-4000-8000-000000000011",
            stage: "before",
          },
          createdAt: "2026-08-02T12:00:00.000Z",
        },
      ],
    });

    const eventQuery =
      database.query.mock.calls[1]?.[0] ?? "";

    expect(eventQuery).toContain(
      "ORDER BY event.created_at ASC, event.id ASC",
    );
  });

  it("returns 404 when the Job does not exist", async () => {
    database.query.mockResolvedValueOnce({
      rows: [],
    });

    await request(app)
      .get(`/api/jobs/${jobId}/journey`)
      .expect(404, {
        ok: false,
        error: "Job was not found.",
      });

    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed Job IDs before querying PostgreSQL", async () => {
    await request(app)
      .get("/api/jobs/not-a-uuid/journey")
      .expect(400, {
        ok: false,
        error: "Invalid job ID.",
      });

    expect(database.query).not.toHaveBeenCalled();
  });
});
