import cors from "cors";
import express from "express";

import { pool } from "./db/pool.js";
import { env } from "./env.js";
import { adminSampleDataRouter } from "./routes/adminSampleData.js";
import { addressAutocompleteRouter } from "./routes/addressAutocomplete.js";
import { calendarRouter, publicCalendarRouter } from "./routes/calendar.js";
import { clientsRouter } from "./routes/clients.js";
import { jobsRouter } from "./routes/jobs.js";
import { mediaLibraryRouter } from "./routes/mediaLibrary.js";
import { jobPhotosRouter } from "./routes/jobPhotos.js";
import { jobVowsRouter } from "./routes/jobVows.js";
import { organizationRouter } from "./routes/organization.js";
import { publicRequestsRouter } from "./routes/publicRequests.js";
import { requestsRouter } from "./routes/requests.js";
import { vowsRouter } from "./routes/vows.js";

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

app.use(
  "/api/address-autocomplete",
  addressAutocompleteRouter,
);
app.use("/api/admin/sample-data", adminSampleDataRouter);
app.use("/api/organization", organizationRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/public/calendar", publicCalendarRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/jobs", jobPhotosRouter);
app.use("/api/jobs", jobVowsRouter);
app.use("/api/media", mediaLibraryRouter);
app.use("/api/public/requests", publicRequestsRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/vows", vowsRouter);
