import {
  publicAvailabilityDaysResponseSchema,
  publicCalendarDateSchema,
  publicCalendarDayResponseSchema,
  publicCalendarDaysResponseSchema,
  publicCalendarSettingsResponseSchema,
  updatePublicCalendarDaySchema,
  updatePublicCalendarSettingsSchema,
  type PublicCalendarDay,
  type PublicCalendarSettings,
  type PublicCalendarStatus,
} from "@vizow/shared";
import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { getOrganizationSlug } from "../organizationScope.js";

export const calendarRouter = Router();
export const publicCalendarRouter = Router();

const rangeQuerySchema = z
  .object({
    from: publicCalendarDateSchema,
    to: publicCalendarDateSchema,
  })
  .strict();

type PublicCalendarDatabaseRow = {
  date: string;
  status: PublicCalendarStatus;
  publicNote: string | null;
  isOverride: boolean;
  updatedAt: Date | null;
};

type PublicCalendarSettingsDatabaseRow = {
  enabled: boolean;
};

function dateNumber(value: string): number {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return Number.NaN;
  }

  return date.getTime();
}

function validateRange(from: string, to: string): string | null {
  const fromNumber = dateNumber(from);
  const toNumber = dateNumber(to);

  if (!Number.isFinite(fromNumber) || !Number.isFinite(toNumber)) {
    return "Invalid calendar range.";
  }

  if (toNumber < fromNumber) {
    return "Calendar range end must be on or after its start.";
  }

  const dayCount = Math.floor((toNumber - fromNumber) / 86_400_000) + 1;

  if (dayCount > 62) {
    return "Calendar range cannot exceed 62 days.";
  }

  return null;
}

function prepareDay(row: PublicCalendarDatabaseRow): PublicCalendarDay {
  return {
    date: row.date,
    status: row.status,
    publicNote: row.publicNote,
    isOverride: row.isOverride,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function prepareSettings(
  row: PublicCalendarSettingsDatabaseRow,
): PublicCalendarSettings {
  return { enabled: row.enabled };
}

async function loadSettings(): Promise<PublicCalendarSettings> {
  const result = await pool.query<PublicCalendarSettingsDatabaseRow>(
    `
      WITH organization AS (
        SELECT id
        FROM organizations
        WHERE slug = $1
      )
      SELECT
        COALESCE(settings.enabled, TRUE) AS enabled
      FROM organization
      LEFT JOIN public_calendar_settings settings
        ON settings.organization_id = organization.id
    `,
    [getOrganizationSlug()],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Organization was not found.");
  }

  return prepareSettings(row);
}

async function loadPublicDays(from: string, to: string): Promise<PublicCalendarDay[]> {
  const result = await pool.query<PublicCalendarDatabaseRow>(
    `
      WITH organization AS (
        SELECT id
        FROM organizations
        WHERE slug = $1
      ), settings AS (
        SELECT
          organization.id AS organization_id,
          COALESCE(calendar.enabled, TRUE) AS enabled
        FROM organization
        LEFT JOIN public_calendar_settings calendar
          ON calendar.organization_id = organization.id
      ), visible_dates AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS date
      ), bookings AS (
        SELECT
          visit.scheduled_start::date AS date,
          count(*)::integer AS visit_count
        FROM visits visit
        JOIN jobs job
          ON job.organization_id = visit.organization_id
         AND job.id = visit.job_id
        CROSS JOIN organization
        WHERE visit.organization_id = organization.id
          AND visit.status <> 'cancelled'
          AND job.cancelled_at IS NULL
          AND job.archived_at IS NULL
          AND visit.scheduled_start::date BETWEEN $2::date AND $3::date
        GROUP BY visit.scheduled_start::date
      )
      SELECT
        visible_dates.date::text AS date,
        CASE
          WHEN NOT settings.enabled
            THEN 'unavailable'::public_calendar_status
          WHEN visible_dates.date < CURRENT_DATE
            THEN 'unavailable'::public_calendar_status
          WHEN override.date IS NOT NULL
            THEN override.status
          WHEN EXTRACT(ISODOW FROM visible_dates.date)::SMALLINT IN (6, 7)
            THEN 'emergencies_only'::public_calendar_status
          WHEN COALESCE(bookings.visit_count, 0) = 0
            THEN 'available'::public_calendar_status
          ELSE 'limited'::public_calendar_status
        END AS status,
        override.public_note AS "publicNote",
        (override.date IS NOT NULL) AS "isOverride",
        override.updated_at AS "updatedAt"
      FROM visible_dates
      CROSS JOIN settings
      LEFT JOIN public_calendar_days override
        ON override.organization_id = settings.organization_id
       AND override.date = visible_dates.date
      LEFT JOIN bookings
        ON bookings.date = visible_dates.date
      ORDER BY visible_dates.date ASC
    `,
    [getOrganizationSlug(), from, to],
  );

  return result.rows.map(prepareDay);
}

function readRangeQuery(query: unknown):
  | { ok: true; from: string; to: string }
  | { ok: false; error: string } {
  const result = rangeQuerySchema.safeParse(query);

  if (!result.success) {
    return { ok: false, error: "A valid from/to calendar range is required." };
  }

  const rangeError = validateRange(result.data.from, result.data.to);

  return rangeError
    ? { ok: false, error: rangeError }
    : { ok: true, ...result.data };
}

publicCalendarRouter.get("/", async (request, response) => {
  const range = readRangeQuery(request.query);

  if (!range.ok) {
    response.status(400).json({ ok: false, error: range.error });
    return;
  }

  try {
    const [settings, days] = await Promise.all([
      loadSettings(),
      loadPublicDays(range.from, range.to),
    ]);

    response.json(
      publicAvailabilityDaysResponseSchema.parse({
        ok: true,
        settings,
        days: days.map(({ date, status, publicNote }) => ({
          date,
          status,
          publicNote,
        })),
      }),
    );
  } catch (error) {
    console.error(error);
    response.status(500).json({ ok: false, error: "Unable to load public availability." });
  }
});

calendarRouter.get("/public", async (request, response) => {
  const range = readRangeQuery(request.query);

  if (!range.ok) {
    response.status(400).json({ ok: false, error: range.error });
    return;
  }

  try {
    const [settings, days] = await Promise.all([
      loadSettings(),
      loadPublicDays(range.from, range.to),
    ]);

    response.json(
      publicCalendarDaysResponseSchema.parse({ ok: true, settings, days }),
    );
  } catch (error) {
    console.error(error);
    response.status(500).json({ ok: false, error: "Unable to load public calendar." });
  }
});

calendarRouter.put("/public/settings", async (request, response) => {
  const inputResult = updatePublicCalendarSettingsSchema.safeParse(request.body);

  if (!inputResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid public calendar settings.",
      issues: inputResult.error.issues,
    });
    return;
  }

  const input = inputResult.data;

  try {
    const result = await pool.query<PublicCalendarSettingsDatabaseRow>(
      `
        INSERT INTO public_calendar_settings (
          organization_id,
          enabled
        )
        SELECT
          organization.id,
          $2
        FROM organizations organization
        WHERE organization.slug = $1
        ON CONFLICT (organization_id)
        DO UPDATE SET
          enabled = EXCLUDED.enabled,
          updated_at = now()
        RETURNING enabled
      `,
      [getOrganizationSlug(), input.enabled],
    );

    const row = result.rows[0];

    if (!row) {
      response.status(404).json({ ok: false, error: "Organization was not found." });
      return;
    }

    response.json(
      publicCalendarSettingsResponseSchema.parse({
        ok: true,
        settings: prepareSettings(row),
      }),
    );
  } catch (error) {
    console.error(error);
    response.status(500).json({ ok: false, error: "Unable to update public calendar settings." });
  }
});

calendarRouter.put("/public/:date", async (request, response) => {
  const dateResult = publicCalendarDateSchema.safeParse(request.params.date);
  const inputResult = updatePublicCalendarDaySchema.safeParse(request.body);

  if (
    !dateResult.success ||
    !Number.isFinite(dateNumber(dateResult.data)) ||
    !inputResult.success
  ) {
    response.status(400).json({ ok: false, error: "Invalid public calendar day." });
    return;
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO public_calendar_days (
          organization_id,
          date,
          status,
          public_note
        )
        SELECT
          organization.id,
          $2::date,
          $3::public_calendar_status,
          NULL
        FROM organizations organization
        WHERE organization.slug = $1
        ON CONFLICT (organization_id, date)
        DO UPDATE SET
          status = EXCLUDED.status,
          public_note = NULL,
          updated_at = now()
      `,
      [getOrganizationSlug(), dateResult.data, inputResult.data.status],
    );

    if (result.rowCount === 0) {
      response.status(404).json({ ok: false, error: "Organization was not found." });
      return;
    }

    const days = await loadPublicDays(dateResult.data, dateResult.data);
    const day = days[0];

    if (!day) {
      response.status(500).json({ ok: false, error: "Unable to reload public calendar day." });
      return;
    }

    response.json(publicCalendarDayResponseSchema.parse({ ok: true, day }));
  } catch (error) {
    console.error(error);
    response.status(500).json({ ok: false, error: "Unable to update public calendar day." });
  }
});

calendarRouter.delete("/public/:date", async (request, response) => {
  const dateResult = publicCalendarDateSchema.safeParse(request.params.date);

  if (!dateResult.success || !Number.isFinite(dateNumber(dateResult.data))) {
    response.status(400).json({ ok: false, error: "Invalid public calendar day." });
    return;
  }

  try {
    await pool.query(
      `
        DELETE FROM public_calendar_days override
        USING organizations organization
        WHERE override.organization_id = organization.id
          AND organization.slug = $1
          AND override.date = $2::date
      `,
      [getOrganizationSlug(), dateResult.data],
    );

    const days = await loadPublicDays(dateResult.data, dateResult.data);
    const day = days[0];

    if (!day) {
      response.status(500).json({ ok: false, error: "Unable to reload public calendar day." });
      return;
    }

    response.json(publicCalendarDayResponseSchema.parse({ ok: true, day }));
  } catch (error) {
    console.error(error);
    response.status(500).json({ ok: false, error: "Unable to clear public calendar override." });
  }
});
