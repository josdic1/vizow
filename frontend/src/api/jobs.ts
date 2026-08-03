import {
  fieldNoteResponseSchema,
  jobResponseSchema,
  jobsResponseSchema,
  type CreateFieldNoteInput,
  type FieldNote,
  type Job,
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
