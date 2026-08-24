type DemoSessionStatus = {
  enabled: boolean;
  active: boolean;
};

async function readError(
  response: Response,
  fallback: string,
): Promise<Error> {
  try {
    const payload: unknown = await response.json();

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

export async function fetchDemoSessionStatus(
  signal?: AbortSignal,
): Promise<DemoSessionStatus> {
  const response = await fetch("/api/demo/session", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to read the private demo session.",
    );
  }

  const payload: unknown = await response.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("enabled" in payload) ||
    typeof payload.enabled !== "boolean" ||
    !("active" in payload) ||
    typeof payload.active !== "boolean"
  ) {
    throw new Error("The demo session API returned an invalid response.");
  }

  return {
    enabled: payload.enabled,
    active: payload.active,
  };
}

export async function startPrivateDemo(): Promise<void> {
  const response = await fetch("/api/demo/session", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to start a private Vizow demo.",
    );
  }
}

export async function resetPrivateDemo(): Promise<void> {
  const response = await fetch("/api/demo/session/reset", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to reset this Vizow demo.",
    );
  }
}

export async function endPrivateDemo(): Promise<void> {
  const response = await fetch("/api/demo/session/end", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to exit this Vizow demo.",
    );
  }
}
