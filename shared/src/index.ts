import { z } from "zod";

export const idSchema = z.uuid();

export const jobStageSchema = z.enum([
  "project",
  "completed",
]);

export const requestStatusSchema = z.enum([
  "open",
  "approved",
  "declined",
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

const optionalTextInputSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value || null);

const optionalEmailInputSchema = z
  .union([z.email(), z.literal("")])
  .optional()
  .nullable()
  .transform((value) => value || null);

export const organizationSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  logoUrl: z.string().nullable(),
  brandSettings: z.record(z.string(), z.unknown()),
});

export const createClientAddressSchema = z.object({
  label: z.string().trim().min(1).default("Primary"),
  addressLine1: z.string().trim().min(1, "Address line 1 is required."),
  addressLine2: optionalTextInputSchema,
  city: z.string().trim().min(1, "City is required."),
  state: z.string().trim().min(1, "State is required."),
  postalCode: z.string().trim().min(1, "Postal code is required."),
});

export const createClientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required."),
  email: optionalEmailInputSchema,
  phone: optionalTextInputSchema,
  notes: optionalTextInputSchema,
  defaultAddress: createClientAddressSchema
    .optional()
    .nullable()
    .transform((value) => value ?? null),
});

export const updateClientSchema = createClientSchema.pick({
  name: true,
  email: true,
  phone: true,
  notes: true,
});

export const createClientPropertySchema =
  createClientAddressSchema.extend({
    isDefault: z.boolean().optional().default(false),
  });

export const updateClientPropertySchema =
  createClientAddressSchema;

export const clientAddressSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  isDefault: z.boolean(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const clientPropertySchema = clientAddressSchema;

export const clientSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  archivedAt: z.string().datetime().nullable(),
  defaultAddress: clientPropertySchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createRequestSchema = z.object({
  clientId: idSchema,
  title: z.string().trim().min(1, "Request title is required."),
  description: optionalTextInputSchema,
  serviceAddressLine1: optionalTextInputSchema,
  serviceAddressLine2: optionalTextInputSchema,
  serviceCity: optionalTextInputSchema,
  serviceState: optionalTextInputSchema,
  servicePostalCode: optionalTextInputSchema,
});

export const jobCycleSchema = z.object({
  id: idSchema,
  cycleNumber: z.number().int().positive(),
  reason: cycleReasonSchema,
  stage: jobStageSchema,
  openedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const jobSchema = z.object({
  id: idSchema,
  clientId: idSchema,
  clientName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  serviceAddressLine1: z.string().nullable(),
  serviceAddressLine2: z.string().nullable(),
  serviceCity: z.string().nullable(),
  serviceState: z.string().nullable(),
  servicePostalCode: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  currentCycle: jobCycleSchema,
});

export const createFieldNoteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Field note is required."),
});

export const fieldNoteSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  jobCycleId: idSchema,
  mediaId: idSchema.nullable(),
  content: z.string().min(1),
  capturedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const mediaSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  jobCycleId: idSchema,
  url: z.string().url(),
  storageKey: z.string().nullable(),
  mimeType: z.string().nullable(),
  stage: mediaStageSchema,
  caption: z.string().nullable(),
  capturedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const requestSchema = z.object({
  id: idSchema,
  clientId: idSchema,
  clientName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  serviceAddressLine1: z.string().nullable(),
  serviceAddressLine2: z.string().nullable(),
  serviceCity: z.string().nullable(),
  serviceState: z.string().nullable(),
  servicePostalCode: z.string().nullable(),
  status: requestStatusSchema,
  approvedJobId: idSchema.nullable(),
  submittedAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const clientRecordSchema = clientSchema.extend({
  properties: z.array(clientPropertySchema),
  requests: z.array(requestSchema),
  jobs: z.array(jobSchema),
});

export const clientsResponseSchema = z.object({
  ok: z.literal(true),
  clients: z.array(clientSchema),
});

export const clientResponseSchema = z.object({
  ok: z.literal(true),
  client: clientSchema,
});

export const clientRecordResponseSchema = z.object({
  ok: z.literal(true),
  client: clientRecordSchema,
});

export const jobsResponseSchema = z.object({
  ok: z.literal(true),
  jobs: z.array(jobSchema),
});

export const jobResponseSchema = z.object({
  ok: z.literal(true),
  job: jobSchema,
});

export const fieldNoteResponseSchema = z.object({
  ok: z.literal(true),
  fieldNote: fieldNoteSchema,
});

export const mediaResponseSchema = z.object({
  ok: z.literal(true),
  media: mediaSchema,
});

export const requestsResponseSchema = z.object({
  ok: z.literal(true),
  requests: z.array(requestSchema),
});

export const requestResponseSchema = z.object({
  ok: z.literal(true),
  request: requestSchema,
});

export const approveRequestResponseSchema = z.object({
  ok: z.literal(true),
  request: requestSchema,
  job: jobSchema,
});

export type JobStage = z.infer<typeof jobStageSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type CycleReason = z.infer<typeof cycleReasonSchema>;
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;
export type MediaStage = z.infer<typeof mediaStageSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type CreateClientAddressInput = z.infer<
  typeof createClientAddressSchema
>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateClientPropertyInput = z.infer<
  typeof createClientPropertySchema
>;
export type UpdateClientPropertyInput = z.infer<
  typeof updateClientPropertySchema
>;
export type ClientAddress = z.infer<typeof clientAddressSchema>;
export type ClientProperty = z.infer<typeof clientPropertySchema>;
export type Client = z.infer<typeof clientSchema>;
export type ClientRecord = z.infer<typeof clientRecordSchema>;
export type ClientResponse = z.infer<typeof clientResponseSchema>;
export type ClientRecordResponse = z.infer<
  typeof clientRecordResponseSchema
>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type CreateFieldNoteInput = z.infer<
  typeof createFieldNoteSchema
>;
export type JobCycle = z.infer<typeof jobCycleSchema>;
export type FieldNote = z.infer<typeof fieldNoteSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Request = z.infer<typeof requestSchema>;
export type ClientsResponse = z.infer<typeof clientsResponseSchema>;
export type JobsResponse = z.infer<typeof jobsResponseSchema>;
export type JobResponse = z.infer<typeof jobResponseSchema>;
export type FieldNoteResponse = z.infer<
  typeof fieldNoteResponseSchema
>;
export type MediaResponse = z.infer<
  typeof mediaResponseSchema
>;
export type RequestsResponse = z.infer<typeof requestsResponseSchema>;
export type RequestResponse = z.infer<typeof requestResponseSchema>;
export type ApproveRequestResponse = z.infer<
  typeof approveRequestResponseSchema
>;
