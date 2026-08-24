import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

import type { PoolClient } from "pg";

import {
  sampleIntakeRequests,
  samplePhotoFiles,
  samplePipelineProjects,
  sampleProjects,
  type SampleProject,
} from "../data/sampleProjects.js";
import { env } from "../env.js";
import { getOrganizationSlug } from "../organizationScope.js";
import {
  sampleMediaDeliveryUrl,
  sampleMediaStorageKey,
} from "./sampleMediaStorage.js";

export type SampleRange = "day" | "week" | "month" | "demo";

export type SampleProfile = {
  days: number;
  clients: number;
  requests: number;
  jobs: number;
  visits: number;
  vows: number;
};

export const realisticSampleProfiles: Record<
  SampleRange,
  SampleProfile
> = {
  day: {
    days: 1,
    clients: 7,
    requests: 7,
    jobs: 5,
    visits: 7,
    vows: 3,
  },
  week: {
    days: 7,
    clients: 14,
    requests: 14,
    jobs: 10,
    visits: 15,
    vows: 5,
  },
  month: {
    days: 30,
    clients: 30,
    requests: 30,
    jobs: 21,
    visits: 21,
    vows: 5,
  },
  demo: {
    days: 7,
    clients: 3,
    requests: 5,
    jobs: 3,
    visits: 5,
    vows: 1,
  },
};

const photoProjectOrder: readonly SampleProject[] = [
  sampleProjects[0],
  sampleProjects[3],
  sampleProjects[1],
  sampleProjects[7],
  sampleProjects[6],
  sampleProjects[2],
  sampleProjects[4],
  sampleProjects[5],
  sampleProjects[8],
  sampleProjects[9],
];

const sampleJobScenarios = [
  ...photoProjectOrder,
  ...samplePipelineProjects,
] as const;

const firstNames = [
  "Mara",
  "Theo",
  "Priya",
  "Casey",
  "Jordan",
  "Lena",
  "Caleb",
  "Iris",
  "Grant",
  "Nora",
  "Eli",
  "June",
  "Owen",
  "Sofia",
  "Marcus",
  "Jamie",
  "Dylan",
  "Avery",
  "Sam",
  "Riley",
] as const;

const lastNames = [
  "Collins",
  "Bennett",
  "Shah",
  "Morgan",
  "Ellis",
  "Brooks",
  "Morris",
  "Nolan",
  "Mercer",
  "Whitman",
  "Hartley",
  "Calder",
  "Chen",
  "Patel",
  "Reed",
  "Sullivan",
  "Parker",
  "Foster",
  "Walsh",
  "Hayes",
] as const;

const addresses = [
  ["18 Cedar View Lane", "South Orange", "NJ", "07079"],
  ["19 Maple Street", "Maplewood", "NJ", "07040"],
  ["20 Ridgefield Avenue", "West Orange", "NJ", "07052"],
  ["21 Forest Hill Road", "Montclair", "NJ", "07042"],
  ["22 Hawthorne Terrace", "Bloomfield", "NJ", "07003"],
  ["23 Walnut Street", "Livingston", "NJ", "07039"],
  ["24 Brookside Court", "Cedar Grove", "NJ", "07009"],
  ["25 Orchard Hill Road", "Orange", "NJ", "07050"],
] as const;

type SeededClient = {
  id: string;
  addressId: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

type SnapshotFieldNote = {
  id: string;
  jobId: string;
  jobCycleId: string;
  mediaId: null;
  content: string;
  capturedAt: string;
  createdAt: string;
};

type SnapshotMedia = {
  id: string;
  jobId: string;
  jobCycleId: string;
  url: string;
  storageKey: string;
  mimeType: "image/jpeg";
  stage: "before" | "during" | "after";
  caption: string;
  capturedAt: string;
  createdAt: string;
};

type VowCandidate = {
  jobId: string;
  client: SeededClient;
  title: string;
  cycleId: string;
  cycleNumber: number;
  openedAt: Date;
  completedAt: Date;
  notes: SnapshotFieldNote[];
  media: SnapshotMedia[];
};

type SeededJob = {
  id: string;
  client: SeededClient;
  title: string;
  description: string;
  createdAt: Date;
};

type Counters = {
  cycle: number;
  visit: number;
  closure: number;
  request: number;
  note: number;
  vow: number;
  event: number;
  media: number;
  revision: number;
  requestMedia: number;
};

const sampleNamespace = new AsyncLocalStorage<string>();

function sampleId(kind: number, index: number): string {
  const namespace = sampleNamespace.getStore();

  if (!namespace) {
    const group = kind.toString(16).padStart(4, "0");
    const tail = (index + 1).toString(16).padStart(12, "0");

    return `f17a5eed-${group}-4000-8000-${tail}`;
  }

  const digest = createHash("sha256")
    .update(`${namespace}:${kind}:${index}`, "utf8")
    .digest("hex");
  const variant = ["8", "9", "a", "b"][
    Number.parseInt(digest[16] ?? "0", 16) % 4
  ];

  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `${variant}${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(value: Date, hours: number): Date {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

async function insertJobEvent(
  client: PoolClient,
  counters: Counters,
  organizationId: string,
  jobId: string,
  cycleId: string | null,
  eventType: string,
  details: Record<string, unknown>,
  createdAt: Date,
): Promise<void> {
  await client.query(
    `
      INSERT INTO job_events (
        id,
        organization_id,
        job_id,
        job_cycle_id,
        event_type,
        details,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `,
    [
      sampleId(10, counters.event),
      organizationId,
      jobId,
      cycleId,
      eventType,
      JSON.stringify(details),
      createdAt,
    ],
  );

  counters.event += 1;
}

async function seedClients(
  client: PoolClient,
  organizationId: string,
  range: SampleRange,
  count: number,
  now: Date,
): Promise<SeededClient[]> {
  const seeded: SeededClient[] = [];

  for (let index = 0; index < count; index += 1) {
    const id = sampleId(1, index);
    const addressId = sampleId(2, index);
    const project =
      sampleJobScenarios[index % sampleJobScenarios.length];
    const firstName = firstNames[index % firstNames.length];
    const lastName =
      lastNames[
        Math.floor(index / firstNames.length) % lastNames.length
      ];
    const address = addresses[index % addresses.length];
    const addressLine1 = `${Number(address[0].split(" ")[0]) +
      Math.floor(index / addresses.length) * 8} ${address[0]
      .split(" ")
      .slice(1)
      .join(" ")}`;
    const createdAt = addDays(now, -(120 + (index % 180)));
    const name = `${firstName} ${lastName}`;

    await client.query(
      `
        INSERT INTO clients (
          id,
          organization_id,
          name,
          email,
          phone,
          notes,
          archived_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $7)
      `,
      [
        id,
        organizationId,
        name,
        `sample-${range}-${index + 1}@example.test`,
        `973-555-${String(1000 + (index % 9000)).padStart(4, "0")}`,
        project.clientNotes,
        createdAt,
      ],
    );

    await client.query(
      `
        INSERT INTO client_addresses (
          id,
          organization_id,
          client_id,
          label,
          is_default,
          address_line_1,
          address_line_2,
          city,
          state,
          postal_code,
          archived_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, 'Primary', true, $4, NULL, $5, $6, $7,
          NULL, $8, $8
        )
      `,
      [
        addressId,
        organizationId,
        id,
        addressLine1,
        address[1],
        address[2],
        address[3],
        createdAt,
      ],
    );

    seeded.push({
      id,
      addressId,
      name,
      addressLine1,
      city: address[1],
      state: address[2],
      postalCode: address[3],
    });
  }

  return seeded;
}

async function seedNotes(
  client: PoolClient,
  counters: Counters,
  organizationId: string,
  jobId: string,
  cycleId: string,
  notes: readonly string[],
  startedAt: Date,
  latestAt: Date,
): Promise<SnapshotFieldNote[]> {
  const seeded: SnapshotFieldNote[] = [];
  const availableHours = Math.max(
    2,
    (latestAt.getTime() - startedAt.getTime()) / (60 * 60 * 1000),
  );

  for (const [index, content] of notes.entries()) {
    const id = sampleId(8, counters.note);
    const capturedAt = addHours(
      startedAt,
      Math.min(availableHours - 0.5, 2 + index * (availableHours / 4)),
    );

    await client.query(
      `
        INSERT INTO field_notes (
          id,
          organization_id,
          job_id,
          job_cycle_id,
          media_id,
          content,
          captured_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, NULL, $5, $6, $6)
      `,
      [id, organizationId, jobId, cycleId, content, capturedAt],
    );

    await insertJobEvent(
      client,
      counters,
      organizationId,
      jobId,
      cycleId,
      "field_note_created",
      { fieldNoteId: id },
      capturedAt,
    );

    seeded.push({
      id,
      jobId,
      jobCycleId: cycleId,
      mediaId: null,
      content,
      capturedAt: capturedAt.toISOString(),
      createdAt: capturedAt.toISOString(),
    });
    counters.note += 1;
  }

  return seeded;
}

async function seedMedia(
  client: PoolClient,
  counters: Counters,
  organizationId: string,
  jobId: string,
  cycleId: string,
  project: SampleProject,
  includeAfter: boolean,
  startedAt: Date,
  latestAt: Date,
): Promise<SnapshotMedia[]> {
  const photos = samplePhotoFiles(project, includeAfter);
  const seeded: SnapshotMedia[] = [];
  const availableHours = Math.max(
    photos.length + 2,
    (latestAt.getTime() - startedAt.getTime()) / (60 * 60 * 1000),
  );

  for (const [index, photo] of photos.entries()) {
    const id = sampleId(11, counters.media);
    const isIntakePhoto = photo.stage === "before" && index === 0;
    const capturedAt = isIntakePhoto
      ? addHours(startedAt, -3)
      : addHours(
          startedAt,
          Math.min(
            availableHours - 0.25,
            1 +
              ((index + 1) * availableHours) /
                (photos.length + 2),
          ),
        );
    const attachedAt = isIntakePhoto
      ? addHours(startedAt, 0.1)
      : capturedAt;
    const storageKey = sampleMediaStorageKey(project.slug, photo.filename);
    const url = sampleMediaDeliveryUrl(project.slug, photo.filename);

    await client.query(
      `
        INSERT INTO media (
          id,
          organization_id,
          job_id,
          job_cycle_id,
          url,
          storage_key,
          mime_type,
          stage,
          caption,
          is_redacted,
          captured_at,
          created_at,
          original_filename,
          storage_provider,
          source_type
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 'image/jpeg', $7, $8,
          false, $9, $9, $10, 'bundled', 'seed'
        )
      `,
      [
        id,
        organizationId,
        jobId,
        cycleId,
        url,
        storageKey,
        photo.stage,
        photo.caption,
        capturedAt,
        photo.filename,
      ],
    );

    await insertJobEvent(
      client,
      counters,
      organizationId,
      jobId,
      cycleId,
      "photo_uploaded",
      {
        mediaId: id,
        stage: photo.stage,
        caption: photo.caption,
      },
      attachedAt,
    );

    seeded.push({
      id,
      jobId,
      jobCycleId: cycleId,
      url,
      storageKey,
      mimeType: "image/jpeg",
      stage: photo.stage,
      caption: photo.caption,
      capturedAt: capturedAt.toISOString(),
      createdAt: capturedAt.toISOString(),
    });
    counters.media += 1;
  }

  return seeded;
}

async function seedApprovedRequest(
  client: PoolClient,
  counters: Counters,
  organizationId: string,
  job: SeededJob,
  now: Date,
): Promise<void> {
  const requestId = sampleId(7, counters.request);
  const submittedAt = addHours(job.createdAt, -4);
  const decidedAt = addHours(job.createdAt, -1);

  await client.query(
    `
      INSERT INTO requests (
        id,
        organization_id,
        client_id,
        title,
        description,
        service_address_line_1,
        service_address_line_2,
        service_city,
        service_state,
        service_postal_code,
        status,
        approved_job_id,
        submitted_at,
        decided_at,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9,
        'approved', $10, $11, $12, $11, $13
      )
    `,
    [
      requestId,
      organizationId,
      job.client.id,
      job.title,
      job.description,
      job.client.addressLine1,
      job.client.city,
      job.client.state,
      job.client.postalCode,
      job.id,
      submittedAt,
      decidedAt,
      now,
    ],
  );

  counters.request += 1;
}

async function seedExtraRequests(
  client: PoolClient,
  counters: Counters,
  organizationId: string,
  clients: SeededClient[],
  range: SampleRange,
  totalRequests: number,
  now: Date,
): Promise<void> {
  const firstExtraRequestIndex = counters.request;

  while (counters.request < totalRequests) {
    const index = counters.request;

    if (range === "demo") {
      const demoIndex = index - firstExtraRequestIndex;
      const existingClient = demoIndex === 1 ? clients[0] : null;
      const submittedName =
        demoIndex === 0 ? "Alex Rivera" : existingClient?.name ?? "Mara Collins";
      const title =
        demoIndex === 0
          ? "Kitchen sink slow drain"
          : "Loose stair handrail";
      const description =
        demoIndex === 0
          ? "Kitchen sink has been draining slower every day. Looking for someone to diagnose it before it backs up completely."
          : "The stair handrail has started pulling away from the wall near the bottom bracket. It moves when you grab it.";
      const submittedAt = addHours(now, demoIndex === 0 ? -3 : -1);
      const addressLine1 = existingClient?.addressLine1 ?? "54 Oak Street";
      const city = existingClient?.city ?? "Maplewood";
      const state = existingClient?.state ?? "NJ";
      const postalCode = existingClient?.postalCode ?? "07040";

      await client.query(
        `
          INSERT INTO requests (
            id,
            organization_id,
            client_id,
            title,
            description,
            service_address_line_1,
            service_address_line_2,
            service_city,
            service_state,
            service_postal_code,
            submitted_name,
            submitted_email,
            submitted_phone,
            preferred_timing,
            preferred_contact,
            status,
            approved_job_id,
            decline_reason,
            submitted_at,
            decided_at,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9,
            $10, $11, $12, $13, $14,
            'open'::request_status, NULL, NULL, $15, NULL, $15, $16
          )
        `,
        [
          sampleId(7, index),
          organizationId,
          existingClient?.id ?? null,
          title,
          description,
          addressLine1,
          city,
          state,
          postalCode,
          submittedName,
          demoIndex === 0
            ? "alex.rivera@example.test"
            : `returning-${index + 1}@example.test`,
          demoIndex === 0 ? "973-555-0142" : "973-555-0188",
          demoIndex === 0
            ? "Tomorrow afternoon if possible."
            : "Any weekday after 2 PM.",
          demoIndex === 0 ? "Text message" : "Email",
          submittedAt,
          now,
        ],
      );

      counters.request += 1;
      continue;
    }

    const seededClient = clients[index % clients.length];
    const title =
      sampleIntakeRequests[
        index % sampleIntakeRequests.length
      ];
    const declined = index % 3 === 0;
    const submittedAt = addDays(now, -(2 + (index % 17)));
    const decidedAt = declined ? addHours(submittedAt, 5) : null;

    await client.query(
      `
        INSERT INTO requests (
          id,
          organization_id,
          client_id,
          title,
          description,
          service_address_line_1,
          service_address_line_2,
          service_city,
          service_state,
          service_postal_code,
          submitted_name,
          submitted_email,
          submitted_phone,
          preferred_timing,
          preferred_contact,
          status,
          approved_job_id,
          decline_reason,
          submitted_at,
          decided_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15::request_status, NULL, $16, $17, $18, $17, $19
        )
      `,
      [
        sampleId(7, index),
        organizationId,
        seededClient.id,
        title,
        `New client request awaiting review: ${title.toLowerCase()}.`,
        seededClient.addressLine1,
        seededClient.city,
        seededClient.state,
        seededClient.postalCode,
        seededClient.name,
        `intake-${index + 1}@example.test`,
        `973-555-${String(2200 + index).padStart(4, "0")}`,
        "Weekday mornings preferred.",
        index % 2 === 0 ? "Text message" : "Email",
        declined ? "declined" : "open",
        declined
          ? "Scheduling and access requirements did not fit the current service window."
          : null,
        submittedAt,
        decidedAt,
        now,
      ],
    );

    counters.request += 1;
  }
}

async function seedVow(
  client: PoolClient,
  counters: Counters,
  organizationId: string,
  candidate: VowCandidate,
  status: "draft" | "published",
  now: Date,
): Promise<void> {
  const id = sampleId(9, counters.vow);
  const createdAt = addHours(candidate.completedAt, 1);
  const snapshot = {
    client: {
      id: candidate.client.id,
      name: candidate.client.name,
    },
    job: {
      id: candidate.jobId,
      title: candidate.title,
      serviceAddressLine1: candidate.client.addressLine1,
      serviceAddressLine2: null,
      serviceCity: candidate.client.city,
      serviceState: candidate.client.state,
      servicePostalCode: candidate.client.postalCode,
    },
    cycle: {
      id: candidate.cycleId,
      cycleNumber: candidate.cycleNumber,
      openedAt: candidate.openedAt.toISOString(),
      completedAt: candidate.completedAt.toISOString(),
    },
    fieldNotes: candidate.notes,
    media: candidate.media,
  };

  await client.query(
    `
      INSERT INTO vows (
        id,
        organization_id,
        client_id,
        title,
        status,
        snapshot,
        published_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
    `,
    [
      id,
      organizationId,
      candidate.client.id,
      `${candidate.title} · Cycle ${candidate.cycleNumber}`,
      status,
      JSON.stringify(snapshot),
      status === "published" ? createdAt : null,
      createdAt,
      now,
    ],
  );

  await client.query(
    `
      INSERT INTO vow_jobs (
        organization_id,
        client_id,
        vow_id,
        job_id,
        job_cycle_id,
        display_order,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, 0, $6)
    `,
    [
      organizationId,
      candidate.client.id,
      id,
      candidate.jobId,
      candidate.cycleId,
      createdAt,
    ],
  );

  for (const [displayOrder, photo] of candidate.media.entries()) {
    await client.query(
      `
        INSERT INTO vow_media (
          organization_id,
          client_id,
          vow_id,
          job_cycle_id,
          media_id,
          display_order,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        organizationId,
        candidate.client.id,
        id,
        candidate.cycleId,
        photo.id,
        displayOrder,
        createdAt,
      ],
    );
  }

  await insertJobEvent(
    client,
    counters,
    organizationId,
    candidate.jobId,
    candidate.cycleId,
    "vow_created",
    {
      vowId: id,
      cycleNumber: candidate.cycleNumber,
      fieldNoteCount: candidate.notes.length,
      mediaCount: candidate.media.length,
    },
    createdAt,
  );

  counters.vow += 1;
}

export async function seedRealisticSampleData(
  client: PoolClient,
  range: SampleRange,
  clearSampleData: (
    client: PoolClient,
    organizationId: string,
  ) => Promise<void>,
  organizationSlug = getOrganizationSlug(),
): Promise<SampleProfile> {
  const profile = realisticSampleProfiles[range];
  const now = new Date();
  const organizationResult = await client.query<{ id: string }>(
    `
      SELECT id
      FROM organizations
      WHERE slug = $1
    `,
    [organizationSlug],
  );
  const organizationId = organizationResult.rows[0]?.id;

  if (!organizationId) {
    throw new Error(
      `Organization ${organizationSlug} was not found.`,
    );
  }

  return sampleNamespace.run(
    organizationSlug === env.ORGANIZATION_SLUG ? "" : organizationId,
    async () => {
  await clearSampleData(client, organizationId);

  const counters: Counters = {
    cycle: 0,
    visit: 0,
    closure: 0,
    request: 0,
    note: 0,
    vow: 0,
    event: 0,
    media: 0,
    revision: 0,
    requestMedia: 0,
  };
  const clients = await seedClients(
    client,
    organizationId,
    range,
    profile.clients,
    now,
  );
  const jobs: SeededJob[] = [];
  const vowCandidates: Array<{
    candidate: VowCandidate;
    summary: string;
  }> = [];
  const summaryByJob = new Map<string, string>();
  const intakeMediaByJobIndex: Array<SnapshotMedia | null> = [];
  let demoScheduledVisitIndex = 0;

  for (let index = 0; index < profile.jobs; index += 1) {
    const project = sampleJobScenarios[index];

    if (!project) {
      throw new Error(
        `The ${range} sample profile requests more unique Jobs than the curated catalog provides.`,
      );
    }

    const richProject =
      index < photoProjectOrder.length
        ? photoProjectOrder[index]
        : null;
    const pipelineProject =
      index >= photoProjectOrder.length
        ? samplePipelineProjects[index - photoProjectOrder.length]
        : null;
    const seededClient = clients[index % clients.length];
    const jobId = sampleId(3, index);
    const createdAt = addDays(now, -project.ageDays);
    const cycleOneCompleted =
      project.state === "completed" ||
      project.state === "reopened" ||
      project.state === "archived";
    const completedAt = cycleOneCompleted
      ? addDays(createdAt, richProject?.durationDays ?? 1)
      : null;
    const cycleOneId = sampleId(4, counters.cycle);
    counters.cycle += 1;

    await client.query(
      `
        INSERT INTO jobs (
          id,
          organization_id,
          client_id,
          title,
          description,
          service_address_line_1,
          service_address_line_2,
          service_city,
          service_state,
          service_postal_code,
          lifecycle_status,
          cancelled_at,
          cancellation_reason,
          archived_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9,
          'active', NULL, NULL, NULL, $10, $11
        )
      `,
      [
        jobId,
        organizationId,
        seededClient.id,
        project.title,
        project.description,
        seededClient.addressLine1,
        seededClient.city,
        seededClient.state,
        seededClient.postalCode,
        createdAt,
        now,
      ],
    );

    await client.query(
      `
        INSERT INTO job_cycles (
          id,
          organization_id,
          job_id,
          cycle_number,
          reason,
          stage,
          opened_at,
          completed_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, 1, 'original', $4, $5, $6, $5, $7
        )
      `,
      [
        cycleOneId,
        organizationId,
        jobId,
        cycleOneCompleted ? "completed" : "open",
        createdAt,
        completedAt,
        now,
      ],
    );

    await insertJobEvent(
      client,
      counters,
      organizationId,
      jobId,
      cycleOneId,
      "job_created",
      {
        sample: true,
        range,
        message: "Job created from an approved client request.",
      },
      createdAt,
    );

    const cycleOneLatest = completedAt ?? addHours(now, -1);
    const cycleOneNotes = richProject
      ? await seedNotes(
          client,
          counters,
          organizationId,
          jobId,
          cycleOneId,
          richProject.cycleOneNotes,
          createdAt,
          cycleOneLatest,
        )
      : [];
    const cycleOneMedia = richProject
      ? await seedMedia(
          client,
          counters,
          organizationId,
          jobId,
          cycleOneId,
          richProject,
          true,
          createdAt,
          cycleOneLatest,
        )
      : [];
    intakeMediaByJobIndex[index] = cycleOneMedia[0] ?? null;

    const cycleByNumber = new Map<number, string>([[1, cycleOneId]]);
    let cycleTwoOpenedAt: Date | null = null;

    if (richProject?.state === "reopened" && completedAt) {
      cycleTwoOpenedAt = addDays(now, -3);
      const cycleTwoId = sampleId(4, counters.cycle);
      counters.cycle += 1;

      await client.query(
        `
          INSERT INTO job_cycles (
            id,
            organization_id,
            job_id,
            cycle_number,
            reason,
            stage,
            opened_at,
            completed_at,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, 2, 'reopened', 'open', $4, NULL, $4, $5
          )
        `,
        [cycleTwoId, organizationId, jobId, cycleTwoOpenedAt, now],
      );
      cycleByNumber.set(2, cycleTwoId);

      await insertJobEvent(
        client,
        counters,
        organizationId,
        jobId,
        cycleTwoId,
        "cycle_reopened",
        {
          previousCycleId: cycleOneId,
          previousCycleNumber: 1,
          cycleNumber: 2,
          reason: richProject.reopenReason,
        },
        cycleTwoOpenedAt,
      );

      await seedNotes(
        client,
        counters,
        organizationId,
        jobId,
        cycleTwoId,
        richProject.cycleTwoNotes ?? [],
        cycleTwoOpenedAt,
        addHours(now, -1),
      );
    }

    const seededVisitIds: string[] = [];

    const visits = richProject
      ? richProject.visits
      : pipelineProject?.scheduledVisit
        ? [
            {
              cycleNumber: 1 as const,
              dayOffset: -((index % 5) + 1),
              status: "scheduled" as const,
              notes: pipelineProject.scheduledVisit,
            },
          ]
        : [];

    for (const visit of visits) {
      const cycleId = cycleByNumber.get(visit.cycleNumber);

      if (!cycleId) {
        throw new Error(
          `Missing Cycle ${visit.cycleNumber} for ${project.title}.`,
        );
      }

      const cycleOpenedAt =
        visit.cycleNumber === 2 && cycleTwoOpenedAt
          ? cycleTwoOpenedAt
          : createdAt;
      const scheduledStart =
        range === "demo" && visit.status === "scheduled"
          ? addHours(addDays(now, demoScheduledVisitIndex++), 1)
          : visit.dayOffset < 0
            ? addDays(now, Math.abs(visit.dayOffset))
            : addDays(cycleOpenedAt, visit.dayOffset);
      const scheduledEnd = addHours(scheduledStart, 2);
      const visitCreatedAt =
        visit.status === "scheduled"
          ? addHours(now, -3)
          : addHours(cycleOpenedAt, 0.5);
      const visitId = sampleId(5, counters.visit);
      seededVisitIds.push(visitId);

      await client.query(
        `
          INSERT INTO visits (
            id,
            organization_id,
            job_id,
            job_cycle_id,
            status,
            scheduled_start,
            scheduled_end,
            notes,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          visitId,
          organizationId,
          jobId,
          cycleId,
          visit.status,
          scheduledStart,
          scheduledEnd,
          visit.notes,
          visitCreatedAt,
          visit.status === "scheduled" ? visitCreatedAt : scheduledEnd,
        ],
      );

      await insertJobEvent(
        client,
        counters,
        organizationId,
        jobId,
        cycleId,
        "visit_scheduled",
        {
          visitId,
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd.toISOString(),
        },
        visitCreatedAt,
      );

      if (visit.status !== "scheduled") {
        await insertJobEvent(
          client,
          counters,
          organizationId,
          jobId,
          cycleId,
          visit.status === "completed"
            ? "visit_completed"
            : "visit_cancelled",
          { visitId, status: visit.status },
          scheduledEnd,
        );
      }

      counters.visit += 1;
    }

    if (richProject?.revision) {
      const revision = richProject.revision;
      const cycleId = cycleByNumber.get(revision.cycleNumber);

      if (!cycleId) {
        throw new Error(
          `Missing revision cycle for ${project.title}.`,
        );
      }

      const revisionId = sampleId(12, counters.revision);
      const revisionAt = addDays(createdAt, revision.dayOffset);
      const linkedVisitId =
        revision.linkedVisitIndex === null
          ? null
          : seededVisitIds[revision.linkedVisitIndex] ?? null;
      const linkedVisit =
        revision.linkedVisitIndex === null
          ? null
          : richProject.visits[revision.linkedVisitIndex] ?? null;
      const relationshipType =
        linkedVisit?.status === "completed"
          ? "discovered_during"
          : "planned_for";

      await client.query(
        `
          INSERT INTO scope_revisions (
            id,
            organization_id,
            job_id,
            job_cycle_id,
            revision_number,
            scope_text,
            price_change,
            reason,
            visit_requirement,
            created_at
          )
          VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9)
        `,
        [
          revisionId,
          organizationId,
          jobId,
          cycleId,
          revision.scopeText,
          revision.priceChange,
          revision.reason,
          revision.visitRequirement,
          revisionAt,
        ],
      );

      if (linkedVisitId) {
        await client.query(
          `
            INSERT INTO scope_revision_visits (
              organization_id,
              job_id,
              job_cycle_id,
              scope_revision_id,
              visit_id,
              relationship_type,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            organizationId,
            jobId,
            cycleId,
            revisionId,
            linkedVisitId,
            relationshipType,
            revisionAt,
          ],
        );

        await insertJobEvent(
          client,
          counters,
          organizationId,
          jobId,
          cycleId,
          "scope_revision_visit_linked",
          {
            scopeRevisionId: revisionId,
            visitId: linkedVisitId,
            visitSource: "existing",
            relationshipType,
          },
          addHours(revisionAt, 0.1),
        );
      }

      await insertJobEvent(
        client,
        counters,
        organizationId,
        jobId,
        cycleId,
        "scope_revision_created",
        {
          scopeRevisionId: revisionId,
          revisionNumber: 1,
          priceChange: revision.priceChange,
          visitRequirement: revision.visitRequirement,
          linkedVisitId,
        },
        revisionAt,
      );
      counters.revision += 1;
    }

    if (cycleOneCompleted && completedAt) {
      if (!richProject) {
        throw new Error(
          `Completed sample Job ${project.title} requires a documented project record.`,
        );
      }

      const closureId = sampleId(6, counters.closure);

      await client.query(
        `
          INSERT INTO closures (
            id,
            organization_id,
            job_id,
            job_cycle_id,
            final_price,
            completion_date,
            notes,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $6)
        `,
        [
          closureId,
          organizationId,
          jobId,
          cycleOneId,
          richProject.finalPrice,
          completedAt,
          `Cycle 1 completed after documented testing and client walkthrough. Final total: $${richProject.finalPrice.toLocaleString("en-US")}.`,
        ],
      );

      await insertJobEvent(
        client,
        counters,
        organizationId,
        jobId,
        cycleOneId,
        "cycle_closed",
        {
          closureId,
          cycleNumber: 1,
          finalPrice: richProject.finalPrice,
        },
        completedAt,
      );
      counters.closure += 1;

      vowCandidates.push({
        candidate: {
          jobId,
          client: seededClient,
          title: project.title,
          cycleId: cycleOneId,
          cycleNumber: 1,
          openedAt: createdAt,
          completedAt,
          notes: cycleOneNotes,
          media: cycleOneMedia,
        },
        summary: project.journeySummary,
      });
    }

    if (project.state === "cancelled") {
      const cancelledAt = addDays(
        createdAt,
        richProject?.durationDays ?? 1,
      );

      await client.query(
        `
          UPDATE jobs
          SET
            lifecycle_status = 'cancelled',
            cancelled_at = $3,
            cancellation_reason = $4,
            updated_at = $5
          WHERE organization_id = $1
            AND id = $2
        `,
        [
          organizationId,
          jobId,
          cancelledAt,
          project.cancellationReason,
          now,
        ],
      );

      await insertJobEvent(
        client,
        counters,
        organizationId,
        jobId,
        cycleOneId,
        "job_cancelled",
        {
          reason: project.cancellationReason,
          cancellationReason: project.cancellationReason,
        },
        cancelledAt,
      );
    }

    if (project.state === "archived" && completedAt) {
      const archivedAt = addDays(completedAt, 14);

      await client.query(
        `
          UPDATE jobs
          SET archived_at = $3, updated_at = $4
          WHERE organization_id = $1
            AND id = $2
        `,
        [organizationId, jobId, archivedAt, now],
      );

      await insertJobEvent(
        client,
        counters,
        organizationId,
        jobId,
        cycleOneId,
        "job_archived",
        { archivedAt: archivedAt.toISOString() },
        archivedAt,
      );
    }

    const job = {
      id: jobId,
      client: seededClient,
      title: project.title,
      description: project.description,
      createdAt,
    };
    jobs.push(job);
    summaryByJob.set(jobId, project.journeySummary);
    const approvedRequestId = sampleId(7, counters.request);
    await seedApprovedRequest(
      client,
      counters,
      organizationId,
      job,
      now,
    );

    const intakeMedia = intakeMediaByJobIndex[jobs.length - 1];
    if (intakeMedia) {
      await client.query(
        `
          INSERT INTO request_media (
            id,
            organization_id,
            request_id,
            media_id,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          sampleId(15, counters.requestMedia),
          organizationId,
          approvedRequestId,
          intakeMedia.id,
          new Date(intakeMedia.createdAt),
        ],
      );
      counters.requestMedia += 1;
    }
  }

  await seedExtraRequests(
    client,
    counters,
    organizationId,
    clients,
    range,
    profile.requests,
    now,
  );

  if (vowCandidates.length < profile.vows) {
    throw new Error(
      `Not enough completed sample cycles for ${profile.vows} VOWs.`,
    );
  }

  for (let index = 0; index < profile.vows; index += 1) {
    const entry = vowCandidates[index];
    await seedVow(
      client,
      counters,
      organizationId,
      entry.candidate,
      range === "demo"
        ? "published"
        : index % 4 === 0
          ? "draft"
          : "published",
      now,
    );
  }

  for (const job of jobs) {
    const eventResult = await client.query<{
      eventCount: number;
      latestEventAt: Date | null;
    }>(
      `
        SELECT
          COUNT(*)::int AS "eventCount",
          MAX(created_at) AS "latestEventAt"
        FROM job_events
        WHERE organization_id = $1
          AND job_id = $2
      `,
      [organizationId, job.id],
    );
    const eventState = eventResult.rows[0];

    await client.query(
      `
        INSERT INTO job_journey_summaries (
          id,
          organization_id,
          job_id,
          summary,
          model,
          event_count,
          latest_event_at,
          generated_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      `,
      [
        sampleId(13, jobs.indexOf(job)),
        organizationId,
        job.id,
        summaryByJob.get(job.id),
        "vizow-sample-curated-v1",
        eventState?.eventCount ?? 0,
        eventState?.latestEventAt ?? null,
        now,
      ],
    );
  }

  return {
    ...profile,
    visits: counters.visit,
    vows: counters.vow,
  };
    },
  );
}
