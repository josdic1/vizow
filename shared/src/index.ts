import { z } from "zod";

export const idSchema = z.uuid();

export const jobStageSchema = z.enum([
  "request",
  "project",
  "completed",
]);

export const cycleReasonSchema = z.enum([
  "original",
  "reopened",
]);

export const disputeStatusSchema = z.enum([
  "open",
  "resolved",
  "withdrawn",
]);

export const mediaStageSchema = z.enum([
  "before",
  "during",
  "after",
]);

export const organizationSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  logoUrl: z.string().nullable(),
  brandSettings: z.record(z.string(), z.unknown()),
});

export type JobStage = z.infer<typeof jobStageSchema>;
export type CycleReason = z.infer<typeof cycleReasonSchema>;
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;
export type MediaStage = z.infer<typeof mediaStageSchema>;
export type Organization = z.infer<typeof organizationSchema>;
