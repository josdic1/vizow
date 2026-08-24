import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import multer from "multer";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { getOrganizationSlug } from "../organizationScope.js";
import {
  deleteRequestPhoto,
  uploadRequestPhoto,
} from "../services/photoUpload.js";

export const publicRequestsRouter = Router();

const nullableText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(max).nullable().optional(),
  );

const publicRequestSchema = z
  .object({
    submittedName: nullableText(200),
    submittedEmail: nullableText(320),
    submittedPhone: nullableText(100),
    serviceAddressLine1: nullableText(300),
    serviceAddressLine2: nullableText(300),
    serviceCity: nullableText(200),
    serviceState: nullableText(100),
    servicePostalCode: nullableText(50),
    description: z.string().trim().min(1).max(5000),
    preferredTiming: nullableText(1000),
    preferredContact: nullableText(500),
  })
  .strict();

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 15 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Only image files are allowed."));
      return;
    }

    callback(null, true);
  },
});

function acceptSinglePhoto(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  photoUpload.single("photo")(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    response.status(400).json({
      ok: false,
      error:
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "Photo must be 15 MB or smaller."
          : error instanceof Error
            ? error.message
            : "Photo upload was rejected.",
    });
  });
}

publicRequestsRouter.post("/", async (request, response) => {
  const inputResult = publicRequestSchema.safeParse(request.body);

  if (!inputResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid request.",
      issues: inputResult.error.issues,
    });
    return;
  }

  const input = inputResult.data;
  const inboxTitle =
    input.description.split(/[.!?\n]/, 1)[0]?.trim().slice(0, 120) ||
    (input.submittedName ? `Request from ${input.submittedName}` : "Incoming request");
  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const result = await databaseClient.query<{ id: string }>(
      `
        INSERT INTO requests (
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
          preferred_contact
        )
        SELECT
          organization.id,
          NULL,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        FROM organizations organization
        WHERE organization.slug = $1
        RETURNING id
      `,
      [
        getOrganizationSlug(),
        inboxTitle,
        input.description,
        input.serviceAddressLine1 ?? null,
        input.serviceAddressLine2 ?? null,
        input.serviceCity ?? null,
        input.serviceState ?? null,
        input.servicePostalCode ?? null,
        input.submittedName ?? null,
        input.submittedEmail ?? null,
        input.submittedPhone ?? null,
        input.preferredTiming ?? null,
        input.preferredContact ?? null,
      ],
    );

    const createdRequest = result.rows[0];
    if (!createdRequest) {
      await databaseClient.query("ROLLBACK");
      response.status(404).json({ ok: false, error: "Organization was not found." });
      return;
    }

    await databaseClient.query(
      `
        INSERT INTO request_events (
          organization_id,
          request_id,
          event_type,
          details
        )
        SELECT id, $2, 'request_received', '{}'::jsonb
        FROM organizations
        WHERE slug = $1
      `,
      [getOrganizationSlug(), createdRequest.id],
    );

    await databaseClient.query("COMMIT");
    response.status(201).json({ ok: true, request: { id: createdRequest.id } });
  } catch (error) {
    await databaseClient.query("ROLLBACK");
    console.error(error);
    response.status(500).json({ ok: false, error: "Unable to send request." });
  } finally {
    databaseClient.release();
  }
});

publicRequestsRouter.post(
  "/:requestId/photos",
  acceptSinglePhoto,
  async (request, response) => {
    const requestIdResult = z.uuid().safeParse(request.params.requestId);
    const photo = (request as Request & { file?: Express.Multer.File }).file;

    if (!requestIdResult.success || !photo) {
      response.status(400).json({ ok: false, error: "A valid Request and photo are required." });
      return;
    }

    const databaseClient = await pool.connect();
    let uploadedPublicId: string | null = null;

    try {
      await databaseClient.query("BEGIN");
      const selectedResult = await databaseClient.query<{
        organizationId: string;
        status: "open" | "approved" | "declined";
      }>(
        `
          SELECT work_request.organization_id AS "organizationId", work_request.status
          FROM requests work_request
          JOIN organizations organization ON organization.id = work_request.organization_id
          WHERE organization.slug = $1 AND work_request.id = $2
          FOR UPDATE OF work_request
        `,
        [getOrganizationSlug(), requestIdResult.data],
      );
      const selected = selectedResult.rows[0];

      if (!selected) {
        await databaseClient.query("ROLLBACK");
        response.status(404).json({ ok: false, error: "Request was not found." });
        return;
      }
      if (selected.status !== "open") {
        await databaseClient.query("ROLLBACK");
        response.status(409).json({ ok: false, error: "Photos cannot be added to a resolved Request." });
        return;
      }

      const uploaded = await uploadRequestPhoto(photo, {
        organizationId: selected.organizationId,
        requestId: requestIdResult.data,
      });
      uploadedPublicId = uploaded.public_id;
      const mediaResult = await databaseClient.query<{ id: string; url: string }>(
        `
          INSERT INTO media (
            organization_id, job_id, job_cycle_id, url, storage_key,
            mime_type, stage, caption, is_redacted, captured_at, original_filename,
            storage_provider, source_type
          )
          VALUES (
            $1, NULL, NULL, $2, $3, $4, 'before', NULL, false, NULL, $5,
            'cloudinary', 'uploaded'
          )
          RETURNING id, url
        `,
        [selected.organizationId, uploaded.secure_url, uploaded.public_id, "image/jpeg", photo.originalname],
      );
      const media = mediaResult.rows[0];
      if (!media) throw new Error("PostgreSQL did not return the Request photo.");

      await databaseClient.query(
        `INSERT INTO request_media (organization_id, request_id, media_id) VALUES ($1, $2, $3)`,
        [selected.organizationId, requestIdResult.data, media.id],
      );
      await databaseClient.query("COMMIT");
      response.status(201).json({ ok: true, media });
    } catch (error) {
      await databaseClient.query("ROLLBACK");
      if (uploadedPublicId) await deleteRequestPhoto(uploadedPublicId).catch(console.error);
      console.error(error);
      response.status(500).json({ ok: false, error: "Unable to save Request photo." });
    } finally {
      databaseClient.release();
    }
  },
);
