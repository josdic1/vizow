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

const photos = vi.hoisted(() => ({
  deleteJobPhoto: vi.fn(),
  uploadJobPhoto: vi.fn(),
}));

vi.mock("../src/db/pool.js", () => ({
  pool: {
    connect: database.connect,
    end: database.end,
    query: vi.fn(),
  },
}));

vi.mock("../src/services/photoUpload.js", () => ({
  deleteJobPhoto: photos.deleteJobPhoto,
  uploadJobPhoto: photos.uploadJobPhoto,
}));

let app: Express;

const organizationId = "00000000-0000-4000-8000-000000000001";
const clientId = "00000000-0000-4000-8000-000000000002";
const jobId = "00000000-0000-4000-8000-000000000003";
const cycleId = "00000000-0000-4000-8000-000000000004";
let lifecycleStatus: "active" | "cancelled";
let archivedAt: Date | null;

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
  database.connect.mockClear();
  database.query.mockReset();
  database.release.mockClear();
  photos.deleteJobPhoto.mockReset();
  photos.uploadJobPhoto.mockReset();

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
          clientId,
          jobCycleId: cycleId,
          lifecycleStatus,
          archivedAt,
          stage: "project",
        }],
      };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
});

async function uploadPhoto(): Promise<request.Response> {
  return request(app)
    .post(`/api/jobs/${jobId}/photos`)
    .field("stage", "during")
    .attach("photo", Buffer.from("photo"), {
      filename: "job-photo.jpg",
      contentType: "image/jpeg",
    });
}

function expectNoPhotoWrite(): void {
  const sqlStatements = database.query.mock.calls.map(
    ([sql]) => sql,
  );

  expect(
    sqlStatements.find((sql) =>
      sql.includes("FROM jobs job"),
    ),
  ).toContain("FOR UPDATE OF job, cycle");

  expect(photos.uploadJobPhoto).not.toHaveBeenCalled();
  expect(sqlStatements).not.toEqual(
    expect.arrayContaining([
      expect.stringContaining("INSERT INTO media"),
    ]),
  );
}

describe("POST /api/jobs/:jobId/photos writable Job guard", () => {
  it("rejects a cancelled Job before uploading a Photo", async () => {
    lifecycleStatus = "cancelled";

    const response = await uploadPhoto();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: "Cancelled Jobs cannot be modified.",
    });
    expectNoPhotoWrite();
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects an archived Job before uploading a Photo", async () => {
    archivedAt = new Date("2026-08-05T14:00:00.000Z");

    const response = await uploadPhoto();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: "Archived Jobs cannot be modified.",
    });
    expectNoPhotoWrite();
    expect(database.release).toHaveBeenCalledOnce();
  });
});
