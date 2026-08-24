import { z } from "zod";

export const idSchema = z.uuid();

export const jobStageSchema = z.enum([
  "open",
  "completed",
]);

export const jobLifecycleStatusSchema = z.enum([
  "active",
  "cancelled",
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

export const visitStatusSchema = z.enum([
  "scheduled",
  "completed",
  "cancelled",
]);

export const mediaStageSchema = z.enum([
  "before",
  "during",
  "after",
]);

export const vowStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);

export const publicCalendarStatusSchema = z.enum([
  "available",
  "limited",
  "emergencies_only",
  "unavailable",
]);

export const publicCalendarOverrideStatusSchema = publicCalendarStatusSchema;

export const publicCalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Calendar date must be YYYY-MM-DD.");

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

export const reviewRequestSchema = createRequestSchema.extend({
  clientId: idSchema,
});

export const declineRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Decline reason is required.")
      .max(
        1000,
        "Decline reason cannot exceed 1000 characters.",
      ),
  })
  .strict();

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

export const jobJourneyEventSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  jobCycleId: idSchema.nullable(),
  eventType: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
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
  lifecycleStatus: jobLifecycleStatusSchema,
  cancelledAt: z.string().datetime().nullable(),
  cancellationReason: z.string().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  currentCycle: jobCycleSchema,
});

export const cancelJobSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Cancellation reason is required.")
      .max(
        1000,
        "Cancellation reason cannot exceed 1000 characters.",
      ),
  })
  .strict();

export const archiveJobSchema = z.object({}).strict();

export const closeJobCycleSchema = z.object({
  finalPrice: z
    .number()
    .finite()
    .nonnegative("Final price cannot be negative.")
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  notes: optionalTextInputSchema,
  confirmScopeVisitWarnings: z
    .boolean()
    .optional()
    .default(false),
});

export const closeJobCycleWarningCodeSchema = z.enum([
  "visit_decision_undecided",
  "required_visit_missing",
  "required_visit_incomplete",
]);

export const closeJobCycleWarningSchema = z.object({
  code: closeJobCycleWarningCodeSchema,
  revisionNumber: z.number().int().positive(),
  scopeText: z.string().min(1),
});

export const closeJobCycleWarningResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string().min(1),
  warnings: z.array(closeJobCycleWarningSchema).min(1),
});

export const reopenJobCycleSchema = z.object({}).strict();

export const scopeVisitRequirementSchema = z.enum([
  "undecided",
  "not_required",
  "required",
]);

export const scopeVisitRelationshipTypeSchema = z.enum([
  "planned_for",
  "discovered_during",
]);

export const createVisitSchema = z
  .object({
    scheduledStart: z.string().datetime(),
    scheduledEnd: z
      .string()
      .datetime()
      .optional()
      .nullable()
      .transform((value) => value ?? null),
    notes: optionalTextInputSchema,
  })
  .refine(
    (visit) =>
      visit.scheduledEnd === null ||
      new Date(visit.scheduledEnd) >
        new Date(visit.scheduledStart),
    {
      message: "Visit end must be after its start.",
      path: ["scheduledEnd"],
    },
  );

export const scopeVisitPlanSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("undecided"),
    })
    .strict(),
  z
    .object({
      mode: z.literal("not_required"),
    })
    .strict(),
  z
    .object({
      mode: z.literal("existing"),
      visitId: idSchema,
      relationshipType:
        scopeVisitRelationshipTypeSchema
          .optional()
          .default("planned_for"),
    })
    .strict(),
  z
    .object({
      mode: z.literal("new"),
      visit: createVisitSchema,
    })
    .strict(),
]);

export const createScopeRevisionSchema = z.object({
  scopeText: z
    .string()
    .trim()
    .min(1, "Scope description is required."),
  priceChange: z
    .number()
    .finite("Price change must be a valid number.")
    .optional()
    .default(0),
  reason: optionalTextInputSchema,
  visitPlan: scopeVisitPlanSchema
    .optional()
    .default({ mode: "undecided" }),
});

export const updateScopeRevisionVisitPlanSchema = z
  .object({
    visitPlan: z.discriminatedUnion("mode", [
      z
        .object({
          mode: z.literal("not_required"),
        })
        .strict(),
      z
        .object({
          mode: z.literal("existing"),
          visitId: idSchema,
          relationshipType: z
            .literal("planned_for")
            .optional()
            .default("planned_for"),
        })
        .strict(),
      z
        .object({
          mode: z.literal("new"),
          visit: createVisitSchema,
        })
        .strict(),
    ]),
  })
  .strict();

export const updateVisitStatusSchema = z
  .object({
    status: z.enum(["completed", "cancelled"]),
  })
  .strict();

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

const mediaDeliveryUrlSchema = z.union([
  z.string().url(),
  z.string().regex(
    /^\/(?!\/).+/,
    "Expected an absolute URL or root-relative media path.",
  ),
]);

export const mediaSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  jobCycleId: idSchema,
  url: mediaDeliveryUrlSchema,
  storageKey: z.string().nullable(),
  mimeType: z.string().nullable(),
  stage: mediaStageSchema,
  caption: z.string().nullable(),
  capturedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const mediaLibraryItemSchema = mediaSchema.extend({
  jobTitle: z.string().min(1),
  clientId: idSchema,
  clientName: z.string().min(1),
  cycleNumber: z.number().int().positive(),
  serviceAddressLine1: z.string().nullable(),
  serviceAddressLine2: z.string().nullable(),
  serviceCity: z.string().nullable(),
  serviceState: z.string().nullable(),
  servicePostalCode: z.string().nullable(),
  attachedNote: z.string().nullable(),
});

export const closureSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  jobCycleId: idSchema,
  finalPrice: z.number().finite().nonnegative().nullable(),
  completionDate: z.string().datetime(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const scopeRevisionSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  jobCycleId: idSchema,
  revisionNumber: z.number().int().positive(),
  scopeText: z.string().min(1),
  priceChange: z.number().finite(),
  reason: z.string().nullable(),
  visitRequirement: scopeVisitRequirementSchema,
  linkedVisitIds: z.array(idSchema),
  createdAt: z.string().datetime(),
});

export const visitScopeRevisionSchema = z.object({
  id: idSchema,
  jobCycleId: idSchema,
  revisionNumber: z.number().int().positive(),
  scopeText: z.string().min(1),
  priceChange: z.number().finite(),
  reason: z.string().nullable(),
  visitRequirement: scopeVisitRequirementSchema,
  relationshipType: scopeVisitRelationshipTypeSchema,
  createdAt: z.string().datetime(),
});

export const visitSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  jobCycleId: idSchema,
  cycleNumber: z.number().int().positive(),
  status: visitStatusSchema,
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  linkedScopeRevisions: z
    .array(visitScopeRevisionSchema)
    .default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createBasicVowSchema = z.object({}).strict();

export const persistedJourneySummarySchema = z.object({
  summary: z.string().min(1),
  model: z.string().min(1),
  eventCount: z.number().int().nonnegative(),
  latestEventAt: z.string().datetime().nullable(),
  generatedAt: z.string().datetime(),
});

export const basicVowSnapshotSchema = z.object({
  client: z.object({
    id: idSchema,
    name: z.string().min(1),
  }),
  job: z.object({
    id: idSchema,
    title: z.string().min(1),
    serviceAddressLine1: z.string().nullable(),
    serviceAddressLine2: z.string().nullable(),
    serviceCity: z.string().nullable(),
    serviceState: z.string().nullable(),
    servicePostalCode: z.string().nullable(),
  }),
  cycle: z.object({
    id: idSchema,
    cycleNumber: z.number().int().positive(),
    openedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
  }),
  fieldNotes: z.array(fieldNoteSchema),
  media: z.array(mediaSchema),
  workSummary: persistedJourneySummarySchema
    .nullable()
    .optional(),
});

export const vowSchema = z.object({
  id: idSchema,
  clientId: idSchema,
  title: z.string().min(1),
  status: vowStatusSchema,
  snapshot: basicVowSnapshotSchema,
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publicCalendarSettingsSchema = z.object({
  enabled: z.boolean(),
});

export const publicCalendarDaySchema = z.object({
  date: publicCalendarDateSchema,
  status: publicCalendarStatusSchema,
  publicNote: z.string().nullable(),
  isOverride: z.boolean(),
  updatedAt: z.string().datetime().nullable(),
});

export const publicAvailabilityDaySchema = z.object({
  date: publicCalendarDateSchema,
  status: publicCalendarStatusSchema,
  publicNote: z.string().nullable(),
});

export const updatePublicCalendarDaySchema = z
  .object({
    status: publicCalendarOverrideStatusSchema,
  })
  .strict();

export const updatePublicCalendarSettingsSchema = publicCalendarSettingsSchema.strict();

export const requestMediaSchema = z.object({
  id: idSchema,
  url: z.string().min(1),
  originalFilename: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const requestSchema = z.object({
  id: idSchema,
  clientId: idSchema.nullable(),
  clientName: z.string().min(1).nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  serviceAddressLine1: z.string().nullable(),
  serviceAddressLine2: z.string().nullable(),
  serviceCity: z.string().nullable(),
  serviceState: z.string().nullable(),
  servicePostalCode: z.string().nullable(),
  status: requestStatusSchema,
  approvedJobId: idSchema.nullable(),
  declineReason: z.string().min(1).nullable(),
  submittedName: z.string().nullable().optional().default(null),
  submittedEmail: z.string().nullable().optional().default(null),
  submittedPhone: z.string().nullable().optional().default(null),
  preferredTiming: z.string().nullable().optional().default(null),
  preferredContact: z.string().nullable().optional().default(null),
  suggestedClientId: idSchema.nullable().optional().default(null),
  suggestedClientName: z.string().nullable().optional().default(null),
  matchReason: z.string().nullable().optional().default(null),
  media: z.array(requestMediaSchema).optional().default([]),
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

export const jobJourneyResponseSchema = z.object({
  ok: z.literal(true),
  events: z.array(jobJourneyEventSchema),
});

export const jobJourneySummaryResponseSchema = z.object({
  ok: z.literal(true),
  summary: z.string().min(1),
  model: z.string().min(1),
  eventCount: z.number().int().nonnegative(),
  latestEventAt: z.string().datetime().nullable(),
  generatedAt: z.string().datetime(),
  stale: z.boolean(),
});

export const jobJourneyStoredSummaryResponseSchema = z.object({
  ok: z.literal(true),
  summary: persistedJourneySummarySchema.nullable(),
  stale: z.boolean(),
});

export const fieldNoteResponseSchema = z.object({
  ok: z.literal(true),
  fieldNote: fieldNoteSchema,
});

export const mediaResponseSchema = z.object({
  ok: z.literal(true),
  media: mediaSchema,
});

export const mediaListResponseSchema = z.object({
  ok: z.literal(true),
  media: z.array(mediaSchema),
});

export const mediaLibraryResponseSchema = z.object({
  ok: z.literal(true),
  media: z.array(mediaLibraryItemSchema),
});

export const closeJobCycleResponseSchema = z.object({
  ok: z.literal(true),
  closure: closureSchema,
  job: jobSchema,
});

export const reopenJobCycleResponseSchema = z.object({
  ok: z.literal(true),
  job: jobSchema,
});

export const scopeRevisionsResponseSchema = z.object({
  ok: z.literal(true),
  scopeRevisions: z.array(scopeRevisionSchema),
});

export const scopeRevisionResponseSchema = z.object({
  ok: z.literal(true),
  scopeRevision: scopeRevisionSchema,
  visit: visitSchema.nullable(),
});

export const visitsResponseSchema = z.object({
  ok: z.literal(true),
  visits: z.array(visitSchema),
});

export const visitResponseSchema = z.object({
  ok: z.literal(true),
  visit: visitSchema,
});

export const basicVowResponseSchema = z.object({
  ok: z.literal(true),
  vow: vowSchema,
});

export const vowsResponseSchema = z.object({
  ok: z.literal(true),
  vows: z.array(vowSchema),
});

export const publicCalendarDaysResponseSchema = z.object({
  ok: z.literal(true),
  settings: publicCalendarSettingsSchema,
  days: z.array(publicCalendarDaySchema),
});

export const publicAvailabilityDaysResponseSchema = z.object({
  ok: z.literal(true),
  settings: publicCalendarSettingsSchema,
  days: z.array(publicAvailabilityDaySchema),
});

export const publicCalendarSettingsResponseSchema = z.object({
  ok: z.literal(true),
  settings: publicCalendarSettingsSchema,
});

export const publicCalendarDayResponseSchema = z.object({
  ok: z.literal(true),
  day: publicCalendarDaySchema,
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

export const declineRequestResponseSchema = z.object({
  ok: z.literal(true),
  request: requestSchema,
});

export type JobStage = z.infer<typeof jobStageSchema>;
export type JobLifecycleStatus = z.infer<
  typeof jobLifecycleStatusSchema
>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type CycleReason = z.infer<typeof cycleReasonSchema>;
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;
export type VisitStatus = z.infer<typeof visitStatusSchema>;
export type ScopeVisitRequirement = z.infer<
  typeof scopeVisitRequirementSchema
>;
export type ScopeVisitRelationshipType = z.infer<
  typeof scopeVisitRelationshipTypeSchema
>;
export type ScopeVisitPlan = z.infer<typeof scopeVisitPlanSchema>;
export type MediaStage = z.infer<typeof mediaStageSchema>;
export type MediaLibraryItem = z.infer<typeof mediaLibraryItemSchema>;
export type VowStatus = z.infer<typeof vowStatusSchema>;
export type PublicCalendarStatus = z.infer<typeof publicCalendarStatusSchema>;
export type PublicCalendarOverrideStatus = z.infer<
  typeof publicCalendarOverrideStatusSchema
>;
export type PublicCalendarSettings = z.infer<typeof publicCalendarSettingsSchema>;
export type PublicCalendarDay = z.infer<typeof publicCalendarDaySchema>;
export type PublicAvailabilityDay = z.infer<typeof publicAvailabilityDaySchema>;
export type UpdatePublicCalendarDayInput = z.infer<
  typeof updatePublicCalendarDaySchema
>;
export type UpdatePublicCalendarSettingsInput = z.infer<
  typeof updatePublicCalendarSettingsSchema
>;
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
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;
export type DeclineRequestInput = z.infer<
  typeof declineRequestSchema
>;
export type CreateFieldNoteInput = z.infer<
  typeof createFieldNoteSchema
>;
export type CancelJobInput = z.infer<
  typeof cancelJobSchema
>;
export type ArchiveJobInput = z.infer<
  typeof archiveJobSchema
>;
export type CloseJobCycleInput = z.input<
  typeof closeJobCycleSchema
>;
export type CloseJobCycleWarningCode = z.infer<
  typeof closeJobCycleWarningCodeSchema
>;
export type CloseJobCycleWarning = z.infer<
  typeof closeJobCycleWarningSchema
>;
export type ReopenJobCycleInput = z.infer<
  typeof reopenJobCycleSchema
>;
export type CreateScopeRevisionInput = z.infer<
  typeof createScopeRevisionSchema
>;
export type UpdateScopeRevisionVisitPlanInput = z.infer<
  typeof updateScopeRevisionVisitPlanSchema
>;
export type CreateVisitInput = z.infer<
  typeof createVisitSchema
>;
export type UpdateVisitStatusInput = z.infer<
  typeof updateVisitStatusSchema
>;
export type CreateBasicVowInput = z.infer<
  typeof createBasicVowSchema
>;
export type JobCycle = z.infer<typeof jobCycleSchema>;
export type FieldNote = z.infer<typeof fieldNoteSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Closure = z.infer<typeof closureSchema>;
export type ScopeRevision = z.infer<
  typeof scopeRevisionSchema
>;
export type VisitScopeRevision = z.infer<
  typeof visitScopeRevisionSchema
>;
export type Visit = z.infer<typeof visitSchema>;
export type PersistedJourneySummary = z.infer<
  typeof persistedJourneySummarySchema
>;
export type BasicVowSnapshot = z.infer<
  typeof basicVowSnapshotSchema
>;
export type Vow = z.infer<typeof vowSchema>;
export type JobJourneyEvent = z.infer<
  typeof jobJourneyEventSchema
>;
export type Job = z.infer<typeof jobSchema>;
export type Request = z.infer<typeof requestSchema>;
export type ClientsResponse = z.infer<typeof clientsResponseSchema>;
export type JobsResponse = z.infer<typeof jobsResponseSchema>;
export type JobResponse = z.infer<typeof jobResponseSchema>;
export type JobJourneyResponse = z.infer<
  typeof jobJourneyResponseSchema
>;
export type JobJourneySummaryResponse = z.infer<
  typeof jobJourneySummaryResponseSchema
>;
export type JobJourneyStoredSummaryResponse = z.infer<
  typeof jobJourneyStoredSummaryResponseSchema
>;
export type FieldNoteResponse = z.infer<
  typeof fieldNoteResponseSchema
>;
export type MediaResponse = z.infer<
  typeof mediaResponseSchema
>;
export type MediaListResponse = z.infer<
  typeof mediaListResponseSchema
>;
export type CloseJobCycleResponse = z.infer<
  typeof closeJobCycleResponseSchema
>;
export type CloseJobCycleWarningResponse = z.infer<
  typeof closeJobCycleWarningResponseSchema
>;
export type ReopenJobCycleResponse = z.infer<
  typeof reopenJobCycleResponseSchema
>;
export type ScopeRevisionsResponse = z.infer<
  typeof scopeRevisionsResponseSchema
>;
export type ScopeRevisionResponse = z.infer<
  typeof scopeRevisionResponseSchema
>;
export type VisitsResponse = z.infer<
  typeof visitsResponseSchema
>;
export type VisitResponse = z.infer<
  typeof visitResponseSchema
>;
export type BasicVowResponse = z.infer<
  typeof basicVowResponseSchema
>;
export type VowsResponse = z.infer<
  typeof vowsResponseSchema
>;
export type PublicCalendarDaysResponse = z.infer<
  typeof publicCalendarDaysResponseSchema
>;
export type PublicAvailabilityDaysResponse = z.infer<
  typeof publicAvailabilityDaysResponseSchema
>;
export type PublicCalendarDayResponse = z.infer<
  typeof publicCalendarDayResponseSchema
>;
export type RequestsResponse = z.infer<typeof requestsResponseSchema>;
export type RequestResponse = z.infer<typeof requestResponseSchema>;
export type ApproveRequestResponse = z.infer<
  typeof approveRequestResponseSchema
>;
export type DeclineRequestResponse = z.infer<
  typeof declineRequestResponseSchema
>;
