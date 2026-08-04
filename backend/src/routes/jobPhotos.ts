import { idSchema } from "@vizow/shared";
import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import multer from "multer";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { env } from "../env.js";
import {
  deleteJobPhoto,
  uploadJobPhoto,
  type MediaStage,
} from "../services/photoUpload.js";

export const jobPhotosRouter = Router();

type UploadedPhotoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type MediaDatabaseRow = {
  id: string;
  jobId: string;
  jobCycleId: string;
  url: string;
  storageKey: string | null;
  mimeType: string | null;
  stage: MediaStage;
  caption: string | null;
  capturedAt: Date | null;
  createdAt: Date;
};

const mediaStageSchema = z.enum([
  "before",
  "during",
  "after",
]);

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 15 * 1024 * 1024,
  },
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
  photoUpload.single("photo")(
    request,
    response,
    (error: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError) {
        response.status(400).json({
          ok: false,
          error:
            error.code === "LIMIT_FILE_SIZE"
              ? "Photo must be 15 MB or smaller."
              : "Photo upload was rejected.",
        });
        return;
      }

      response.status(400).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Photo upload was rejected.",
      });
    },
  );
}

jobPhotosRouter.post(
  "/:jobId/photos",
  acceptSinglePhoto,
  async (request, response) => {
    const jobIdResult = idSchema.safeParse(
      request.params.jobId,
    );

    if (!jobIdResult.success) {
      response.status(400).json({
        ok: false,
        error: "Invalid job ID.",
      });
      return;
    }

    const stageResult = mediaStageSchema.safeParse(
      request.body.stage,
    );

    if (!stageResult.success) {
      response.status(400).json({
        ok: false,
        error:
          "Photo stage must be before, during, or after.",
      });
      return;
    }

    const photo = (
      request as Request & {
        file?: UploadedPhotoFile;
      }
    ).file;

    if (!photo) {
      response.status(400).json({
        ok: false,
        error: "A photo is required.",
      });
      return;
    }

    const databaseClient = await pool.connect();
    let uploadedPublicId: string | null = null;

    try {
      await databaseClient.query("BEGIN");

      const cycleResult = await databaseClient.query<{
        organizationId: string;
        clientId: string;
        jobCycleId: string;
        stage: string;
      }>(
        `
          SELECT
            job.organization_id AS "organizationId",
            job.client_id AS "clientId",
            cycle.id AS "jobCycleId",
            cycle.stage
          FROM jobs job
          JOIN organizations organization
            ON organization.id = job.organization_id
          JOIN job_cycles cycle
            ON cycle.organization_id = job.organization_id
           AND cycle.job_id = job.id
           AND cycle.cycle_number = (
             SELECT MAX(candidate.cycle_number)
             FROM job_cycles candidate
             WHERE candidate.organization_id =
               job.organization_id
               AND candidate.job_id = job.id
           )
          WHERE job.id = $1
            AND organization.slug = $2
          FOR SHARE OF job, cycle
        `,
        [
          jobIdResult.data,
          env.ORGANIZATION_SLUG,
        ],
      );

      const currentCycle = cycleResult.rows[0];

      if (!currentCycle) {
        await databaseClient.query("ROLLBACK");

        response.status(404).json({
          ok: false,
          error: "Job was not found.",
        });
        return;
      }

      if (currentCycle.stage !== "project") {
        await databaseClient.query("ROLLBACK");

        response.status(409).json({
          ok: false,
          error:
            "Photos can only be added to an active work cycle.",
        });
        return;
      }

      const cloudinaryResult = await uploadJobPhoto(
        photo,
        {
          clientId: currentCycle.clientId,
          jobId: jobIdResult.data,
          jobCycleId: currentCycle.jobCycleId,
          stage: stageResult.data,
        },
      );

      uploadedPublicId = cloudinaryResult.public_id;

      const mediaResult =
        await databaseClient.query<MediaDatabaseRow>(
          `
            INSERT INTO media (
              organization_id,
              job_id,
              job_cycle_id,
              url,
              storage_key,
              mime_type,
              stage,
              captured_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              now()
            )
            RETURNING
              id,
              job_id AS "jobId",
              job_cycle_id AS "jobCycleId",
              url,
              storage_key AS "storageKey",
              mime_type AS "mimeType",
              stage,
              caption,
              captured_at AS "capturedAt",
              created_at AS "createdAt"
          `,
          [
            currentCycle.organizationId,
            jobIdResult.data,
            currentCycle.jobCycleId,
            cloudinaryResult.secure_url,
            cloudinaryResult.public_id,
            photo.mimetype,
            stageResult.data,
          ],
        );

      const createdMedia = mediaResult.rows[0];

      if (!createdMedia) {
        throw new Error(
          "PostgreSQL did not return the created photo.",
        );
      }

      await databaseClient.query(
        `
          INSERT INTO job_events (
            organization_id,
            job_id,
            job_cycle_id,
            event_type,
            details
          )
          VALUES (
            $1,
            $2,
            $3,
            'photo_uploaded',
            jsonb_build_object(
              'mediaId',
              $4::uuid,
              'stage',
              $5::text
            )
          )
        `,
        [
          currentCycle.organizationId,
          jobIdResult.data,
          currentCycle.jobCycleId,
          createdMedia.id,
          stageResult.data,
        ],
      );

      await databaseClient.query("COMMIT");

      response.status(201).json({
        ok: true,
        media: {
          ...createdMedia,
          capturedAt:
            createdMedia.capturedAt?.toISOString() ??
            null,
          createdAt:
            createdMedia.createdAt.toISOString(),
        },
      });
    } catch (error) {
      await databaseClient.query("ROLLBACK");

      if (uploadedPublicId) {
        try {
          await deleteJobPhoto(uploadedPublicId);
        } catch (cleanupError) {
          console.error(
            "Unable to remove orphaned Cloudinary photo.",
            cleanupError,
          );
        }
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "Unable to save photo.",
      });
    } finally {
      databaseClient.release();
    }
  },
);
