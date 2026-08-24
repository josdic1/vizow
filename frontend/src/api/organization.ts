import {
  organizationSchema,
  type Organization,
} from "@vizow/shared";

export class DemoSessionRequiredError extends Error {
  constructor() {
    super("A private Vizow demo session is required.");
    this.name = "DemoSessionRequiredError";
  }
}

export async function fetchOrganization(
  signal?: AbortSignal,
): Promise<Organization> {
  const response = await fetch("/api/organization", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new DemoSessionRequiredError();
    }

    throw new Error(
      `Failed to load organization. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("ok" in payload) ||
    payload.ok !== true ||
    !("organization" in payload)
  ) {
    throw new Error(
      "The organization API returned an invalid response.",
    );
  }

  const result = organizationSchema.safeParse(payload.organization);

  if (!result.success) {
    console.error(
      "Invalid organization response:",
      result.error,
    );

    throw new Error(
      "The organization API returned an invalid organization.",
    );
  }

  return result.data;
}
