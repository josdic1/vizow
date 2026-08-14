import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  samplePhotoFiles,
  samplePipelineProjects,
  sampleProjects,
} from "../src/data/sampleProjects.js";

const projectAssetsRoot = fileURLToPath(
  new URL("../../frontend/public/sample-projects/", import.meta.url),
);

describe("curated sample project catalog", () => {
  it("maps every supplied project image to exactly one staged caption", () => {
    expect(sampleProjects).toHaveLength(10);
    expect(new Set(sampleProjects.map((project) => project.slug)).size).toBe(
      sampleProjects.length,
    );

    for (const project of sampleProjects) {
      const directory = `${projectAssetsRoot}${project.slug}`;
      const expected = samplePhotoFiles(project, true)
        .map((photo) => photo.filename)
        .sort();
      const actual = readdirSync(directory)
        .filter(
          (filename) =>
            filename.endsWith(".png") && !filename.startsWith("._"),
        )
        .sort();

      expect(existsSync(directory)).toBe(true);
      expect(expected).toEqual(actual);
    }
  });

  it("contains honest lifecycle variety and project-specific records", () => {
    const states = new Set(sampleProjects.map((project) => project.state));

    expect(states).toEqual(
      new Set(["open", "completed", "reopened", "cancelled", "archived"]),
    );

    for (const project of sampleProjects) {
      expect(project.clientNotes.length).toBeGreaterThan(20);
      expect(project.cycleOneNotes.length).toBeGreaterThanOrEqual(3);
      expect(project.visits.length).toBeGreaterThan(0);
      expect(project.journeySummary.length).toBeGreaterThan(100);
    }
  });

  it("keeps every supplied after photo available for documented close-out", () => {
    for (const project of sampleProjects) {
      const stages = samplePhotoFiles(project, true).map(
        (photo) => photo.stage,
      );

      expect(stages).toContain("after");
    }
  });
});

describe("realistic Admin sample-data seed", () => {
  let seedRealisticSampleData: typeof import("../src/services/sampleDataSeed.js").seedRealisticSampleData;

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = "http://localhost:5173";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.CLOUDINARY_API_KEY = "test";
    process.env.CLOUDINARY_API_SECRET = "test";
    process.env.CLOUDINARY_FOLDER = "test";
    process.env.ORGANIZATION_SLUG = "test-organization";

    ({ seedRealisticSampleData } = await import(
      "../src/services/sampleDataSeed.js"
    ));
  });

  async function runSeed(range: "day" | "week" | "month") {
    const queries: Array<{ sql: string; values: unknown[] | undefined }> = [];
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });

      if (
        sql.includes("SELECT id") && sql.includes("FROM organizations")
      ) {
        return { rows: [{ id: "11111111-1111-4111-8111-111111111111" }] };
      }

      if (sql.includes("COUNT(*)::int")) {
        return {
          rows: [{ eventCount: 12, latestEventAt: new Date() }],
        };
      }

      return { rows: [] };
    });
    const fakeClient = { query } as unknown as PoolClient;
    const clear = vi.fn(async () => undefined);

    const counts = await seedRealisticSampleData(
      fakeClient,
      range,
      clear,
    );

    return { counts, queries, clear };
  }

  it("builds the day profile with five unique working Jobs", async () => {
    const { counts, queries, clear } = await runSeed("day");

    expect(counts).toEqual({
      days: 1,
      clients: 7,
      requests: 7,
      jobs: 5,
      visits: 7,
      vows: 3,
    });
    expect(clear).toHaveBeenCalledOnce();

    const mediaInserts = queries.filter((entry) =>
      entry.sql.includes("INSERT INTO media"),
    );
    const noteInserts = queries.filter((entry) =>
      entry.sql.includes("INSERT INTO field_notes"),
    );
    const vowMediaInserts = queries.filter((entry) =>
      entry.sql.includes("INSERT INTO vow_media"),
    );
    const journeyEventInserts = queries.filter((entry) =>
      entry.sql.includes("INSERT INTO job_events"),
    );

    expect(mediaInserts).toHaveLength(40);
    expect(noteInserts).toHaveLength(16);
    expect(vowMediaInserts.length).toBeGreaterThan(0);
    expect(journeyEventInserts.length).toBeGreaterThan(60);

    for (const insert of mediaInserts) {
      expect(insert.values?.[4]).toMatch(
        /^http:\/\/localhost:5173\/sample-projects\//,
      );
    }

    const vowInsert = queries.find((entry) =>
      entry.sql.includes("INSERT INTO vows"),
    );
    const snapshot = JSON.parse(String(vowInsert?.values?.[5]));

    expect(snapshot.fieldNotes.length).toBeGreaterThan(0);
    expect(snapshot.media.length).toBeGreaterThan(0);
    expect(snapshot.media[0].url).toContain("/sample-projects/");

    const eventTypes = journeyEventInserts.map((entry) =>
      String(entry.values?.[4]),
    );

    expect(eventTypes).toContain("visit_completed");
    expect(eventTypes).toContain("cycle_closed");
    expect(eventTypes).toContain("cycle_reopened");
    expect(eventTypes).toContain("job_cancelled");
    expect(eventTypes).toContain("job_archived");

    expect(
      queries.filter((entry) => entry.sql.includes("INSERT INTO request_media")),
    ).toHaveLength(5);
    expect(
      queries.some((entry) => entry.sql.includes("INSERT INTO submissions")),
    ).toBe(false);
  });

  it("builds cumulative Week and Month profiles without duplicate Jobs", async () => {
    const week = await runSeed("week");
    const month = await runSeed("month");

    expect(week.counts).toEqual({
      days: 7,
      clients: 14,
      requests: 14,
      jobs: 10,
      visits: 15,
      vows: 5,
    });
    expect(month.counts).toEqual({
      days: 30,
      clients: 30,
      requests: 30,
      jobs: 21,
      visits: 21,
      vows: 5,
    });

    const jobTitles = (queries: typeof month.queries) =>
      queries
        .filter((entry) => entry.sql.includes("INSERT INTO jobs"))
        .map((entry) => String(entry.values?.[3]));
    const weekTitles = jobTitles(week.queries);
    const monthTitles = jobTitles(month.queries);

    expect(new Set(weekTitles).size).toBe(10);
    expect(new Set(monthTitles).size).toBe(21);
    expect(monthTitles.slice(0, 10)).toEqual(weekTitles);
    expect(new Set(monthTitles)).toEqual(
      new Set([
        ...sampleProjects.map((project) => project.title),
        ...samplePipelineProjects.map((project) => project.title),
      ]),
    );
    expect(weekTitles.slice(0, 5)).toEqual([
      "Roof leak investigation",
      "Sump pump problem",
      "Dead kitchen outlet",
      "Door alignment",
      "Bathroom fan replacement",
    ]);

    const monthMedia = month.queries.filter((entry) =>
      entry.sql.includes("INSERT INTO media"),
    );

    expect(monthMedia).toHaveLength(80);
    expect(
      month.queries.filter((entry) =>
        entry.sql.includes("INSERT INTO field_notes"),
      ),
    ).toHaveLength(31);

    expect(
      month.queries.filter((entry) => entry.sql.includes("INSERT INTO request_media")),
    ).toHaveLength(10);
    expect(
      month.queries.some((entry) => entry.sql.includes("INSERT INTO submissions")),
    ).toBe(false);
  });
});
