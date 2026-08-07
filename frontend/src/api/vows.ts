import {
  basicVowResponseSchema,
  vowsResponseSchema,
  type Vow,
} from "@vizow/shared";

async function readError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const payload: unknown = await response.json();

  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return new Error(payload.error);
  }

  return new Error(fallback);
}

export async function fetchVows(
  signal?: AbortSignal,
  jobId?: string,
): Promise<Vow[]> {
  const query = jobId
    ? `?jobId=${encodeURIComponent(jobId)}`
    : "";
  const response = await fetch(`/api/vows${query}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw await readError(
      response,
      `Failed to load VOWs. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = vowsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid /api/vows response:", result.error);
    throw new Error("The VOW API returned an invalid response.");
  }

  return result.data.vows;
}

export async function fetchVow(
  vowId: string,
  signal?: AbortSignal,
): Promise<Vow> {
  const response = await fetch(
    `/api/vows/${encodeURIComponent(vowId)}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw await readError(
      response,
      `Failed to load the VOW. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = basicVowResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid VOW response:", result.error);
    throw new Error("The VOW API returned an invalid response.");
  }

  return result.data.vow;
}
