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

export const clientAddressSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  isDefault: z.boolean(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
});

export const clientSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  defaultAddress: clientAddressSchema.nullable(),
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

export const clientsResponseSchema = z.object({
  ok: z.literal(true),
  clients: z.array(clientSchema),
});

export const clientResponseSchema = z.object({
  ok: z.literal(true),
  client: clientSchema,
});

export const jobsResponseSchema = z.object({
  ok: z.literal(true),
  jobs: z.array(jobSchema),
});

export const jobResponseSchema = z.object({
  ok: z.literal(true),
  job: jobSchema,
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

export const operationPlans = {
  create_client: [
    { key: "received", label: "Received" },
    { key: "validated", label: "Validated" },
    { key: "organization_verified", label: "Organization verified" },
    { key: "client_written", label: "Client written" },
    { key: "address_written", label: "Property written" },
    { key: "committed", label: "Committed" },
    { key: "response_ready", label: "Response ready" },
  ],
  create_request: [
    { key: "received", label: "Received" },
    { key: "validated", label: "Validated" },
    { key: "client_verified", label: "Client verified" },
    { key: "request_written", label: "Request written" },
    { key: "history_written", label: "History written" },
    { key: "committed", label: "Committed" },
    { key: "response_ready", label: "Response ready" },
  ],
  approve_request: [
    { key: "received", label: "Received" },
    { key: "validated", label: "Validated" },
    { key: "request_locked", label: "Request locked" },
    { key: "eligibility_checked", label: "Approval checked" },
    { key: "job_written", label: "Job written" },
    { key: "cycle_written", label: "Cycle written" },
    { key: "request_updated", label: "Request updated" },
    { key: "request_history_written", label: "Request history written" },
    { key: "job_history_written", label: "Job history written" },
    { key: "committed", label: "Committed" },
    { key: "response_ready", label: "Response ready" },
  ],
} as const;

export const operationKindSchema = z.enum([
  "create_client",
  "create_request",
  "approve_request",
]);

export const operationStatusSchema = z.enum([
  "working",
  "success",
  "error",
]);

export const operationCheckpointSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  reachedAt: z.string().datetime(),
});

export const operationTraceSchema = z.object({
  id: idSchema,
  kind: operationKindSchema,
  status: operationStatusSchema,
  checkpointKey: z.string().nullable(),
  checkpointLabel: z.string().min(1),
  reached: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  message: z.string().min(1),
  failureAt: z.string().nullable(),
  checkpoints: z.array(operationCheckpointSchema),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const operationResponseSchema = z.object({
  ok: z.literal(true),
  operation: operationTraceSchema,
});

export type OperationKind = z.infer<typeof operationKindSchema>;
export type OperationStatus = z.infer<typeof operationStatusSchema>;
export type OperationCheckpoint = z.infer<
  typeof operationCheckpointSchema
>;
export type OperationTrace = z.infer<typeof operationTraceSchema>;

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
export type ClientAddress = z.infer<typeof clientAddressSchema>;
export type Client = z.infer<typeof clientSchema>;
export type ClientResponse = z.infer<typeof clientResponseSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type JobCycle = z.infer<typeof jobCycleSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Request = z.infer<typeof requestSchema>;
export type ClientsResponse = z.infer<typeof clientsResponseSchema>;
export type JobsResponse = z.infer<typeof jobsResponseSchema>;
export type JobResponse = z.infer<typeof jobResponseSchema>;
export type RequestsResponse = z.infer<typeof requestsResponseSchema>;
export type RequestResponse = z.infer<typeof requestResponseSchema>;
export type ApproveRequestResponse = z.infer<
  typeof approveRequestResponseSchema
>;
