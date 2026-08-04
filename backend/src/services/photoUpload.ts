import type { UploadApiResponse } from "cloudinary";

import {
  cloudinary,
  cloudinaryBaseFolder,
} from "../config/cloudinary.js";

export type MediaStage =
  | "before"
  | "during"
  | "after";

type UploadJobPhotoInput = {
  clientId: string;
  jobId: string;
  jobCycleId: string;
  stage: MediaStage;
};

type UploadedPhotoFile = {
  originalname: string;
  buffer: Buffer;
};

export function uploadJobPhoto(
  file: UploadedPhotoFile,
  input: UploadJobPhotoInput,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          asset_folder:
            `${cloudinaryBaseFolder}/jobs/${input.jobId}`,
          tags: [
            "vizow",
            "job-photo",
            input.stage,
          ],
          context: {
            client_id: input.clientId,
            job_id: input.jobId,
            job_cycle_id: input.jobCycleId,
            stage: input.stage,
            original_filename: file.originalname,
          },
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result) {
            reject(
              new Error(
                "Cloudinary upload returned no result.",
              ),
            );
            return;
          }

          resolve(result);
        },
      );

    uploadStream.end(file.buffer);
  });
}

export async function deleteJobPhoto(
  publicId: string,
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
}
