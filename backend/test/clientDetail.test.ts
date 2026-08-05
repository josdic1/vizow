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
const createdAt = new Date("2026-08-01T12:00:00.000Z");
const cancelledAt = new Date("2026-08-04T15:30:00.000Z");
const archivedAt = new Date("2026-08-05T09:00:00.000Z");

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

  database.query.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM clients client")) {
      return {
        rows: [{
          id: clientId,
          name: "Jamie Whitfield",
          email: "jamie@example.com",
          phone: null,
          notes: null,
          archivedAt: null,
          defaultAddress: null,
          createdAt,
          updatedAt: createdAt,
        }],
      };
    }

    if (sql.includes("FROM client_addresses property")) {
      return { rows: [] };
    }

    if (sql.includes("FROM requests request")) {
      return { rows: [] };
    }

    if (sql.includes("FROM jobs job")) {
      return {
        rows: [{
          id: jobId,
          clientId,
          clientName: "Jamie Whitfield",
          title: "Repair roof leak",
          description: null,
          serviceAddressLine1: "482 Maple Street",
          serviceAddressLine2: null,
          serviceCity: "South Orange",
          serviceState: "NJ",
          servicePostalCode: "07079",
          lifecycleStatus: "cancelled",
          cancelledAt,
          cancellationReason: "Client postponed the project.",
          archivedAt,
          createdAt,
          updatedAt: archivedAt,
          cycleId,
          cycleNumber: 1,
          cycleReason: "original",
          cycleStage: "project",
          cycleOpenedAt: createdAt,
          cycleCompletedAt: null,
          cycleCreatedAt: createdAt,
          cycleUpdatedAt: createdAt,
        }],
      };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
});

describe("GET /api/clients/:clientId", () => {
  it("returns each Job with its complete lifecycle state", async () => {
    const response = await request(app)
      .get(`/api/clients/${clientId}`)
      .expect(200);

    expect(response.body.client.jobs).toEqual([
      expect.objectContaining({
        id: jobId,
        lifecycleStatus: "cancelled",
        cancelledAt: cancelledAt.toISOString(),
        cancellationReason: "Client postponed the project.",
        archivedAt: archivedAt.toISOString(),
        currentCycle: expect.objectContaining({
          id: cycleId,
          stage: "project",
        }),
      }),
    ]);
  });
});
