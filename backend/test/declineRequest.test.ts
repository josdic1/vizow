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
const clientId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const now = new Date("2026-08-05T12:00:00.000Z");
const reason = "The requested work is outside our service area.";
let requestStatus: "open" | "approved" | "declined";

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
  requestStatus = "open";
  database.connect.mockClear();
  database.query.mockReset();
  database.release.mockClear();

  database.query.mockImplementation(
    async (sql: string, values?: unknown[]) => {
      if (
        sql === "BEGIN" ||
        sql === "COMMIT" ||
        sql === "ROLLBACK"
      ) {
        return { rows: [] };
      }

      if (sql.includes("FROM requests work_request")) {
        return {
          rows: [{
            organizationId,
            id: requestId,
            clientId,
            clientName: "Jamie Whitfield",
            title: "Repair roof leak",
            description: "Water near the chimney.",
            serviceAddressLine1: "482 Maple Street",
            serviceAddressLine2: null,
            serviceCity: "South Orange",
            serviceState: "NJ",
            servicePostalCode: "07079",
            status: requestStatus,
            approvedJobId:
              requestStatus === "approved"
                ? "00000000-0000-4000-8000-000000000004"
                : null,
            declineReason:
              requestStatus === "declined" ? reason : null,
            submittedAt: now,
            decidedAt:
              requestStatus === "open" ? null : now,
            createdAt: now,
            updatedAt: now,
          }],
        };
      }

      if (sql.includes("UPDATE requests")) {
        return {
          rows: [{
            id: requestId,
            clientId,
            title: "Repair roof leak",
            description: "Water near the chimney.",
            serviceAddressLine1: "482 Maple Street",
            serviceAddressLine2: null,
            serviceCity: "South Orange",
            serviceState: "NJ",
            servicePostalCode: "07079",
            status: "declined",
            approvedJobId: null,
            declineReason: values?.[0],
            submittedAt: now,
            decidedAt: now,
            createdAt: now,
            updatedAt: now,
          }],
        };
      }

      if (sql.includes("INSERT INTO request_events")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  );
});

describe("POST /api/requests/:requestId/decline", () => {
  it("declines an open Request with a permanent reason", async () => {
    const response = await request(app)
      .post(`/api/requests/${requestId}/decline`)
      .send({ reason: `  ${reason}  ` })
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      request: {
        id: requestId,
        status: "declined",
        approvedJobId: null,
        declineReason: reason,
      },
    });

    const sqlStatements = database.query.mock.calls.map(
      ([sql]) => sql,
    );

    expect(
      sqlStatements.find((sql) =>
        sql.includes("FROM requests work_request"),
      ),
    ).toContain("FOR UPDATE OF work_request");

    expect(sqlStatements).toEqual(
      expect.arrayContaining([
        expect.stringContaining("UPDATE requests"),
        expect.stringContaining("INSERT INTO request_events"),
      ]),
    );

    expect(database.query.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringContaining("UPDATE requests"),
          [reason, organizationId, requestId],
        ]),
      ]),
    );

    const transactionCommands = sqlStatements.filter(
      (sql) =>
        sql === "BEGIN" ||
        sql === "COMMIT" ||
        sql === "ROLLBACK",
    );

    expect(transactionCommands).toEqual(["BEGIN", "COMMIT"]);
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rejects a blank decline reason before opening a transaction", async () => {
    const response = await request(app)
      .post(`/api/requests/${requestId}/decline`)
      .send({ reason: "   " })
      .expect(400);

    expect(response.body).toMatchObject({
      ok: false,
      error: "Invalid Request decline.",
    });
    expect(database.connect).not.toHaveBeenCalled();
  });

  it("rejects a Request that is already declined", async () => {
    requestStatus = "declined";

    const response = await request(app)
      .post(`/api/requests/${requestId}/decline`)
      .send({ reason })
      .expect(409);

    expect(response.body).toEqual({
      ok: false,
      error: "Request has already been declined.",
    });

    const sqlStatements = database.query.mock.calls.map(
      ([sql]) => sql,
    );

    expect(sqlStatements).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("UPDATE requests"),
      ]),
    );
    expect(database.release).toHaveBeenCalledOnce();
  });
});
