import type { Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

let app: Express | undefined;
let pool: Pool | undefined;

beforeAll(async () => {
  process.env.DATABASE_URL ??=
    "postgresql://vizow_test:vizow_test@localhost:5432/vizow_test";

  process.env.ORGANIZATION_SLUG ??= "test-organization";

  ({ app } = await import("../src/app.js"));
  ({ pool } = await import("../src/db/pool.js"));
});

afterAll(async () => {
  await pool?.end();
});

describe("Vizow API", () => {
  it("reports that the server is healthy", async () => {
    const response = await request(app)
      .get("/health")
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      app: "vizow",
    });
  });

  it("does not expose the removed operations API", async () => {
    await request(app)
      .get("/api/operations/example")
      .expect(404);
  });
});
