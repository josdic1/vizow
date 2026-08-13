export type SampleRange =
  | "day"
  | "week"
  | "month";

async function readError(
  response: Response,
  fallback: string,
): Promise<Error> {
  try {
    const payload: unknown =
      await response.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return new Error(payload.error);
    }
  } catch {
    // Use fallback.
  }

  return new Error(fallback);
}

export async function loadSampleData(
  range: SampleRange,
): Promise<void> {
  const response = await fetch(
    `/api/admin/sample-data/${range}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw await readError(
      response,
      `Unable to load ${range} sample data.`,
    );
  }
}

export async function clearSampleData(): Promise<void> {
  const response = await fetch(
    "/api/admin/sample-data",
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to clear Vizow data.",
    );
  }
}
