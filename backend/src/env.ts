import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),

  FRONTEND_ORIGIN: z
    .string()
    .url()
    .default("http://localhost:5173"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required."),

  GEOAPIFY_API_KEY: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().min(1).optional(),
  ),

  CLOUDINARY_CLOUD_NAME: z
    .string()
    .trim()
    .min(1, "CLOUDINARY_CLOUD_NAME is required."),

  CLOUDINARY_API_KEY: z
    .string()
    .trim()
    .min(1, "CLOUDINARY_API_KEY is required."),

  CLOUDINARY_API_SECRET: z
    .string()
    .trim()
    .min(1, "CLOUDINARY_API_SECRET is required."),

  CLOUDINARY_FOLDER: z
    .string()
    .trim()
    .min(1, "CLOUDINARY_FOLDER is required."),

  ORGANIZATION_SLUG: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "ORGANIZATION_SLUG must be lowercase words separated by hyphens.",
    ),
});

export const env = environmentSchema.parse(process.env);
