import cors from "cors";
import express from "express";

import { pool } from "./db/pool.js";
import { env } from "./env.js";
import { clientsRouter } from "./routes/clients.js";
import { jobsRouter } from "./routes/jobs.js";
import { organizationRouter } from "./routes/organization.js";
import { requestsRouter } from "./routes/requests.js";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
  }),
);

app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    app: "vizow",
  });
});

app.get("/health/database", async (_request, response) => {
  try {
    const result = await pool.query<{
      database_name: string;
      user_name: string;
    }>(`
      SELECT
        current_database() AS database_name,
        current_user AS user_name
    `);

    response.json({
      ok: true,
      database: result.rows[0],
    });
  } catch {
    response.status(503).json({
      ok: false,
      error: "Database unavailable.",
    });
  }
});

app.use("/api/organization", organizationRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/requests", requestsRouter);
