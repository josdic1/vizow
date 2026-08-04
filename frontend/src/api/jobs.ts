import {
  basicVowResponseSchema,
  closeJobCycleResponseSchema,
  fieldNoteResponseSchema,
  jobResponseSchema,
  jobsResponseSchema,
  mediaResponseSchema,
  reopenJobCycleResponseSchema,
  scopeRevisionResponseSchema,
  type CloseJobCycleInput,
  type Closure,
  type CreateFieldNoteInput,
  type CreateScopeRevisionInput,
  type FieldNote,
  type Job,
  type Media,
  type MediaStage,
  type ScopeRevision,
  type Vow,
} from "@vizow/shared";

export async function fetchJobs(signal?: AbortSignal): Promise<Job[]> {
  const response = await fetch("/api/jobs", {
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

export async function createScopeRevision(
  jobId: string,
  input: CreateScopeRevisionInput,
  signal?: AbortSignal,
): Promise<ScopeRevision> {
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

  return result.data.scopeRevision;
}
