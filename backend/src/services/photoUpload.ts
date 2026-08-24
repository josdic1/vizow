import { randomUUID } from "node:crypto";

import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import sharp from "sharp";

import {
  cloudinary,
  cloudinaryBaseFolder,
} from "../config/cloudinary.js";

export type MediaStage =
  | "before"
  | "during"
  | "after";

type UploadJobPhotoInput = {
  organizationId: string;
  clientId: string;
  jobId: string;
  jobCycleId: string;
  stage: MediaStage;
};

type UploadedPhotoFile = {
  originalname: string;
  buffer: Buffer;
};

const MAX_STORED_WIDTH = 2400;
const STORED_JPEG_QUALITY = 84;
const CLOUDINARY_FREE_IMAGE_LIMIT_BYTES = 10 * 1024 * 1024;

async function normalizePhotoBuffer(buffer: Buffer): Promise<Buffer> {
  const normalized = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_STORED_WIDTH,
      height: MAX_STORED_WIDTH,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: STORED_JPEG_QUALITY,
      progressive: true,
    })
    .toBuffer();

  if (normalized.length >= CLOUDINARY_FREE_IMAGE_LIMIT_BYTES) {
    throw new Error(
      "Photo could not be reduced below the Cloudinary image-size limit.",
    );
  }

  return normalized;
}

function uploadBuffer(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload returned no result."));
          return;
        }

        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
}

export async function uploadJobPhoto(
  file: UploadedPhotoFile,
  input: UploadJobPhotoInput,
): Promise<UploadApiResponse> {
  const publicId =
    `${cloudinaryBaseFolder}/workspaces/${input.organizationId}` +
    `/jobs/${input.jobId}/${randomUUID()}`;
  const normalizedBuffer = await normalizePhotoBuffer(file.buffer);

  return uploadBuffer(normalizedBuffer, {
    resource_type: "image",
    public_id: publicId,
    overwrite: false,
    unique_filename: false,
    format: "jpg",
    tags: [
      "vizow",
      "job-photo",
      input.stage,
    ],
    context: {
      organization_id: input.organizationId,
      client_id: input.clientId,
      job_id: input.jobId,
      job_cycle_id: input.jobCycleId,
      stage: input.stage,
      original_filename: file.originalname,
    },
  });
}

export async function deleteMediaAsset(
  publicId: string,
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
}

export const deleteJobPhoto = deleteMediaAsset;

type UploadRequestPhotoInput = {
  organizationId: string;
  requestId: string;
};

export async function uploadRequestPhoto(
  file: UploadedPhotoFile,
  input: UploadRequestPhotoInput,
): Promise<UploadApiResponse> {
  const publicId =
    `${cloudinaryBaseFolder}/workspaces/${input.organizationId}` +
    `/requests/${input.requestId}/${randomUUID()}`;
  const normalizedBuffer = await normalizePhotoBuffer(file.buffer);

  return uploadBuffer(normalizedBuffer, {
    resource_type: "image",
    public_id: publicId,
    overwrite: false,
    unique_filename: false,
    format: "jpg",
    tags: [
      "vizow",
      "request-photo",
    ],
    context: {
      organization_id: input.organizationId,
      request_id: input.requestId,
      original_filename: file.originalname,
    },
  });
}

export const deleteRequestPhoto = deleteMediaAsset;
