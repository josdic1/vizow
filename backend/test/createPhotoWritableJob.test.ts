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
const mediaId = "00000000-0000-4000-8000-000000000005";
const uploadedPublicId = "vizow/test-photo";
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
  createdAt = new Date("2026-08-05T14:30:00.000Z");
  database.connect.mockClear();
  database.query.mockReset();
  database.release.mockClear();
  photos.deleteJobPhoto.mockReset();
  photos.uploadJobPhoto.mockReset();
  photos.uploadJobPhoto.mockResolvedValue({
    public_id: uploadedPublicId,
    secure_url: "https://example.com/job-photo.jpg",
  });

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
          jobCycleId: cycleId,
          lifecycleStatus,
          archivedAt,
          stage: "open",
        }],
      };
    }

    if (sql.includes("INSERT INTO media")) {
      return {
        rows: [{
          id: mediaId,
          jobId,
          jobCycleId: cycleId,
          url: "https://example.com/job-photo.jpg",
          storageKey: uploadedPublicId,
          mimeType: "image/jpeg",
          stage: "during",
          caption: null,
          capturedAt: new Date("2026-08-05T14:30:00.000Z"),
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

describe("POST /api/jobs/:jobId/photos commit boundary", () => {
  it("builds a valid response before committing", async () => {
    const response = await uploadPhoto();

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ok: true,
      media: {
        id: mediaId,
        jobId,
        jobCycleId: cycleId,
        url: "https://example.com/job-photo.jpg",
        storageKey: uploadedPublicId,
        mimeType: "image/jpeg",
        stage: "during",
        caption: null,
        capturedAt: "2026-08-05T14:30:00.000Z",
        createdAt: "2026-08-05T14:30:00.000Z",
      },
    });

    const sqlStatements = database.query.mock.calls.map(
      ([sql]) => sql,
    );

    expect(sqlStatements).toContain("COMMIT");
    expect(sqlStatements).not.toContain("ROLLBACK");
    expect(photos.deleteJobPhoto).not.toHaveBeenCalled();
  });

  it("rolls back and deletes the upload when response construction fails before commit", async () => {
    createdAt = new Date("invalid");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await uploadPhoto();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: "Unable to save photo.",
      });

      const sqlStatements = database.query.mock.calls.map(
        ([sql]) => sql,
      );

      expect(sqlStatements).not.toContain("COMMIT");
      expect(sqlStatements).toContain("ROLLBACK");
      expect(photos.deleteJobPhoto).toHaveBeenCalledOnce();
      expect(photos.deleteJobPhoto).toHaveBeenCalledWith(
        uploadedPublicId,
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps the upload when response delivery fails after commit", async () => {
    const responseJson = vi
      .spyOn(expressResponse, "json")
      .mockImplementationOnce(() => {
        throw new Error("Simulated response delivery failure.");
      });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await uploadPhoto();

      expect(response.status).toBe(500);

      const sqlStatements = database.query.mock.calls.map(
        ([sql]) => sql,
      );

      expect(sqlStatements).toContain("COMMIT");
      expect(sqlStatements).not.toContain("ROLLBACK");
      expect(photos.deleteJobPhoto).not.toHaveBeenCalled();
    } finally {
      responseJson.mockRestore();
      consoleError.mockRestore();
    }
  });
});
