import { jobsResponseSchema, type Job } from "@vizow/shared";

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
