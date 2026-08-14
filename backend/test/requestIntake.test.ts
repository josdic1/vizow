import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  return {
    query,
    release,
    connect: vi.fn(async () => ({ query, release })),
    end: vi.fn(),
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
const now = new Date("2026-08-12T13:00:00.000Z");

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://vizow_test:vizow_test@localhost:5432/vizow_test";
  process.env.ORGANIZATION_SLUG = "test-organization";
  process.env.CLOUDINARY_CLOUD_NAME = "test";
  process.env.CLOUDINARY_API_KEY = "test";
  process.env.CLOUDINARY_API_SECRET = "test";
  process.env.CLOUDINARY_FOLDER = "test";
  ({ app } = await import("../src/app.js"));
});

beforeEach(() => {
  database.query.mockReset();
  database.release.mockClear();
  database.connect.mockClear();
});

describe("Request intake boundary", () => {
  it("creates an open Request directly from the public form", async () => {
    database.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("INSERT INTO requests")) return { rows: [{ id: requestId }] };
      if (sql.includes("INSERT INTO request_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .post("/api/public/requests")
      .send({
        submittedName: "Devon Price",
        submittedEmail: "devon@example.test",
        description: "Kitchen sink drains slowly and backs up.",
        serviceAddressLine1: "73 Prospect Avenue",
        serviceCity: "Montclair",
        serviceState: "NJ",
        servicePostalCode: "07042",
      })
      .expect(201);

    expect(response.body).toEqual({ ok: true, request: { id: requestId } });
    expect(database.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO submissions"))).toBe(false);
  });

  it("saves the contractor-approved Client and scope before approval", async () => {
    database.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("FROM clients client")) {
        return { rows: [{ organizationId, clientName: "Devon Price", archivedAt: null }] };
      }
      if (sql.includes("UPDATE requests")) {
        return {
          rows: [{
            id: requestId,
            clientId,
            clientName: "Devon Price",
            title: "Clear kitchen sink drain",
            description: "Diagnose and clear the kitchen sink drain.",
            serviceAddressLine1: "73 Prospect Avenue",
            serviceAddressLine2: null,
            serviceCity: "Montclair",
            serviceState: "NJ",
            servicePostalCode: "07042",
            status: "open",
            approvedJobId: null,
            declineReason: null,
            submittedName: "Devon Price",
            submittedEmail: "devon@example.test",
            submittedPhone: null,
            preferredTiming: null,
            preferredContact: null,
            submittedAt: now,
            decidedAt: null,
            createdAt: now,
            updatedAt: now,
          }],
        };
      }
      if (sql.includes("INSERT INTO request_events")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .patch(`/api/requests/${requestId}/review`)
      .send({
        clientId,
        title: "Clear kitchen sink drain",
        description: "Diagnose and clear the kitchen sink drain.",
        serviceAddressLine1: "73 Prospect Avenue",
        serviceAddressLine2: null,
        serviceCity: "Montclair",
        serviceState: "NJ",
        servicePostalCode: "07042",
      })
      .expect(200);

    expect(response.body.request).toMatchObject({
      clientId,
      title: "Clear kitchen sink drain",
      status: "open",
    });
  });
});
