import {
  basicVowResponseSchema,
  closeJobCycleResponseSchema,
  closeJobCycleWarningResponseSchema,
  fieldNoteResponseSchema,
  jobResponseSchema,
  jobJourneyResponseSchema,
  jobJourneySummaryResponseSchema,
  jobJourneyStoredSummaryResponseSchema,
  jobsResponseSchema,
  mediaListResponseSchema,
  mediaResponseSchema,
  reopenJobCycleResponseSchema,
  scopeRevisionResponseSchema,
  scopeRevisionsResponseSchema,
  visitResponseSchema,
  visitsResponseSchema,
  type CancelJobInput,
  type CloseJobCycleInput,
  type CloseJobCycleWarning,
  type Closure,
  type CreateFieldNoteInput,
  type CreateScopeRevisionInput,
  type CreateVisitInput,
  type FieldNote,
  type Job,
  type JobJourneyEvent,
  type Media,
  type MediaStage,
  type ScopeRevision,
  type UpdateScopeRevisionVisitPlanInput,
  type UpdateVisitStatusInput,
  type Visit,
  type Vow,
} from "@vizow/shared";

export class CloseJobCycleWarningError extends Error {
  readonly warnings: CloseJobCycleWarning[];

  constructor(
    message: string,
    warnings: CloseJobCycleWarning[],
  ) {
    super(message);
    this.name = "CloseJobCycleWarningError";
    this.warnings = warnings;
  }
}

export async function fetchJobs(
  signal?: AbortSignal,
  includeArchived = false,
): Promise<Job[]> {
  const query = includeArchived
    ? "?includeArchived=true"
    : "";

  const response = await fetch(`/api/jobs${query}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load jobs. HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const result = jobsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid /api/jobs response:", result.error);
    throw new Error("The jobs API returned an invalid response.");
  }

  return result.data.jobs;
}


export async function fetchJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<Job> {
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Job was not found.");
    }

    throw new Error(`Failed to load job. HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const result = jobResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid job detail response:", result.error);
    throw new Error("The job API returned an invalid response.");
  }

  return result.data.job;
}

export async function createFieldNote(
  jobId: string,
  input: CreateFieldNoteInput,
  signal?: AbortSignal,
): Promise<FieldNote> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/field-notes`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to create field note. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result = fieldNoteResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid field note response:",
      result.error,
    );

    throw new Error(
      "The field note API returned an invalid response.",
    );
  }

  return result.data.fieldNote;
}

export async function uploadJobPhoto(
  jobId: string,
  photo: File,
  stage: MediaStage,
  signal?: AbortSignal,
): Promise<Media> {
  const formData = new FormData();

  formData.append("photo", photo);
  formData.append("stage", stage);

  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/photos`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: formData,
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to upload photo. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result = mediaResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid photo upload response:",
      result.error,
    );

    throw new Error(
      "The photo API returned an invalid response.",
    );
  }

  return result.data.media;
}

export async function fetchJobPhotos(
  jobId: string,
  signal?: AbortSignal,
): Promise<Media[]> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/photos`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load Job photos. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = mediaListResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid Job photos response:",
      result.error,
    );

    throw new Error(
      "The Job photos API returned an invalid response.",
    );
  }

  return result.data.media;
}

export async function fetchJobJourney(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobJourneyEvent[]> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/journey`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load Job journey. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = jobJourneyResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid Job journey response:",
      result.error,
    );

    throw new Error(
      "The Job journey API returned an invalid response.",
    );
  }

  return result.data.events;
}

export async function fetchJobJourneySummary(
  jobId: string,
  signal?: AbortSignal,
): Promise<{
  summary: {
    summary: string;
    model: string;
    eventCount: number;
    latestEventAt: string | null;
    generatedAt: string;
  } | null;
  stale: boolean;
}> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/journey-summary`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to load Journey summary. HTTP ${response.status}.`,
    );
  }

  const result =
    jobJourneyStoredSummaryResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid stored Journey summary response:",
      result.error,
    );

    throw new Error(
      "The stored Journey summary API returned an invalid response.",
    );
  }

  return {
    summary: result.data.summary,
    stale: result.data.stale,
  };
}

export async function summarizeJobJourney(
  jobId: string,
  signal?: AbortSignal,
): Promise<{
  summary: string;
  model: string;
  eventCount: number;
  latestEventAt: string | null;
  generatedAt: string;
  stale: boolean;
}> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/journey-summary`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to summarize Job journey. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result =
    jobJourneySummaryResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid Job journey summary response:",
      result.error,
    );

    throw new Error(
      "The Journey summary API returned an invalid response.",
    );
  }

  return {
    summary: result.data.summary,
    model: result.data.model,
    eventCount: result.data.eventCount,
    latestEventAt: result.data.latestEventAt,
    generatedAt: result.data.generatedAt,
    stale: result.data.stale,
  };
}

export async function closeJobCycle(
  jobId: string,
  input: CloseJobCycleInput,
  signal?: AbortSignal,
): Promise<{
  closure: Closure;
  job: Job;
}> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/close-cycle`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    if (response.status === 409) {
      const warningResult =
        closeJobCycleWarningResponseSchema.safeParse(payload);

      if (warningResult.success) {
        throw new CloseJobCycleWarningError(
          warningResult.data.error,
          warningResult.data.warnings,
        );
      }
    }

    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to close work cycle. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result =
    closeJobCycleResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid close-cycle response:",
      result.error,
    );

    throw new Error(
      "The close-cycle API returned an invalid response.",
    );
  }

  return {
    closure: result.data.closure,
    job: result.data.job,
  };
}

export async function createBasicVow(
  jobId: string,
  signal?: AbortSignal,
): Promise<Vow> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/basic-vow`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to generate VOW. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result =
    basicVowResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid basic VOW response:",
      result.error,
    );

    throw new Error(
      "The VOW API returned an invalid response.",
    );
  }

  return result.data.vow;
}

export async function reopenJobCycle(
  jobId: string,
  signal?: AbortSignal,
): Promise<Job> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/reopen-cycle`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to reopen work cycle. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result =
    reopenJobCycleResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid reopen-cycle response:",
      result.error,
    );

    throw new Error(
      "The reopen-cycle API returned an invalid response.",
    );
  }

  return result.data.job;
}

export async function fetchScopeRevisions(
  jobId: string,
  signal?: AbortSignal,
): Promise<ScopeRevision[]> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/scope-revisions`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to load scope revisions. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result =
    scopeRevisionsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid scope revisions response:",
      result.error,
    );

    throw new Error(
      "The scope revisions API returned an invalid response.",
    );
  }

  return result.data.scopeRevisions;
}

export async function createScopeRevision(
  jobId: string,
  input: CreateScopeRevisionInput,
  signal?: AbortSignal,
): Promise<{
  scopeRevision: ScopeRevision;
  visit: Visit | null;
}> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/scope-revisions`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to create scope revision. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result =
    scopeRevisionResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid scope revision response:",
      result.error,
    );

    throw new Error(
      "The scope revision API returned an invalid response.",
    );
  }

  return {
    scopeRevision: result.data.scopeRevision,
    visit: result.data.visit,
  };
}

export async function updateScopeRevisionVisitPlan(
  jobId: string,
  scopeRevisionId: string,
  input: UpdateScopeRevisionVisitPlanInput,
  signal?: AbortSignal,
): Promise<{
  scopeRevision: ScopeRevision;
  visit: Visit | null;
}> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/scope-revisions/${encodeURIComponent(scopeRevisionId)}/visit-plan`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to update Scope Revision. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result =
    scopeRevisionResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid Scope Revision update response:",
      result.error,
    );

    throw new Error(
      "The Scope Revision update API returned an invalid response.",
    );
  }

  return {
    scopeRevision: result.data.scopeRevision,
    visit: result.data.visit,
  };
}

export async function fetchVisits(
  jobId: string,
  signal?: AbortSignal,
): Promise<Visit[]> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/visits`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to load visits. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result = visitsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid visits response:",
      result.error,
    );

    throw new Error(
      "The visits API returned an invalid response.",
    );
  }

  return result.data.visits;
}

export async function createVisit(
  jobId: string,
  input: CreateVisitInput,
  signal?: AbortSignal,
): Promise<Visit> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/visits`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to schedule visit. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result = visitResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid Visit response:",
      result.error,
    );

    throw new Error(
      "The Visit API returned an invalid response.",
    );
  }

  return result.data.visit;
}

export async function updateVisitStatus(
  jobId: string,
  visitId: string,
  input: UpdateVisitStatusInput,
  signal?: AbortSignal,
): Promise<Visit> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/visits/${encodeURIComponent(visitId)}/status`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to update Visit. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result = visitResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid Visit status response:",
      result.error,
    );

    throw new Error(
      "The Visit API returned an invalid response.",
    );
  }

  return result.data.visit;
}

type JobLifecycleAction =
  | "cancel"
  | "archive"
  | "unarchive";

async function runJobLifecycleAction(
  jobId: string,
  action: JobLifecycleAction,
  body: object,
  signal?: AbortSignal,
): Promise<Job> {
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/${action}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    },
  );

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `The ${action} Job API returned an unreadable response.`,
    );
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to ${action} Job. HTTP ${response.status}.`;

    throw new Error(message);
  }

  const result = jobResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      `Invalid ${action} Job response:`,
      result.error,
    );

    throw new Error(
      `The ${action} Job API returned an invalid response.`,
    );
  }

  return result.data.job;
}

export async function cancelJob(
  jobId: string,
  input: CancelJobInput,
  signal?: AbortSignal,
): Promise<Job> {
  return runJobLifecycleAction(
    jobId,
    "cancel",
    input,
    signal,
  );
}

export async function archiveJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<Job> {
  return runJobLifecycleAction(
    jobId,
    "archive",
    {},
    signal,
  );
}

export async function unarchiveJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<Job> {
  return runJobLifecycleAction(
    jobId,
    "unarchive",
    {},
    signal,
  );
}
