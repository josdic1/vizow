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
const eventId = "00000000-0000-4000-8000-000000000003";

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
  vi.unstubAllGlobals();
});

describe("POST /api/jobs/:jobId/journey-summary", () => {
  it("summarizes the enriched Journey with local Ollama", async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: jobId,
            title: "Kitchen Repair",
            clientName: "Sample Client",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: eventId,
            jobId,
            jobCycleId: cycleId,
            eventType: "field_note_created",
            details: {
              fieldNoteId:
                "00000000-0000-4000-8000-000000000010",
              fieldNote: {
                content: "Found water damage behind sink.",
                capturedAt:
                  "2026-08-01T12:00:00.000Z",
              },
            },
            createdAt: new Date(
              "2026-08-01T12:00:00.000Z",
            ),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            generatedAt: new Date(
              "2026-08-01T12:05:00.000Z",
            ),
          },
        ],
      });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response:
            "Water damage was documented behind the sink.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post(`/api/jobs/${jobId}/journey-summary`)
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      summary:
        "Water damage was documented behind the sink.",
      model: "qwen3:8b",
      eventCount: 1,
      latestEventAt:
        "2026-08-01T12:00:00.000Z",
      generatedAt:
        "2026-08-01T12:05:00.000Z",
      stale: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      "http://127.0.0.1:11434/api/generate",
    );

    const body = JSON.parse(
      (options as RequestInit).body as string,
    );

    expect(body.model).toBe("qwen3:8b");
    expect(body.think).toBe(false);
    expect(body.stream).toBe(false);
    expect(body.prompt).toContain(
      "Found water damage behind sink.",
    );
  });

  it("returns 404 when the Job does not exist", async () => {
    database.query.mockResolvedValueOnce({
      rows: [],
    });

    await request(app)
      .post(`/api/jobs/${jobId}/journey-summary`)
      .expect(404, {
        ok: false,
        error: "Job was not found.",
      });

    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when local Ollama is unavailable", async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: jobId,
            title: "Kitchen Repair",
            clientName: "Sample Client",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        new Error("Connection refused"),
      ),
    );

    await request(app)
      .post(`/api/jobs/${jobId}/journey-summary`)
      .expect(503, {
        ok: false,
        error:
          "Local AI is unavailable. Make sure Ollama is running.",
      });
  });

  it("rejects malformed Job IDs before querying PostgreSQL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await request(app)
      .post("/api/jobs/not-a-uuid/journey-summary")
      .expect(400, {
        ok: false,
        error: "Invalid job ID.",
      });

    expect(database.query).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
