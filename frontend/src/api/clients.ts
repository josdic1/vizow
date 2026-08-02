import {
  clientResponseSchema,
  clientsResponseSchema,
  type Client,
  type CreateClientInput,
} from "@vizow/shared";

import { trackedFetch } from "../operations/operationStore";

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    // Use the fallback when the response body is not JSON.
  }

  return fallback;
}

export async function fetchClients(
  signal?: AbortSignal,
): Promise<Client[]> {
  const response = await fetch("/api/clients", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load clients. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = clientsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid /api/clients response:", result.error);
    throw new Error("The clients API returned an invalid response.");
  }

  return result.data.clients;
}

export async function fetchClient(
  clientId: string,
  signal?: AbortSignal,
): Promise<Client> {
  const response = await fetch(
    `/api/clients/${encodeURIComponent(clientId)}`,
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
      await readApiError(
        response,
        `Failed to load Client. HTTP ${response.status}.`,
      ),
    );
  }

  const payload: unknown = await response.json();
  const result = clientResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid Client response:", result.error);
    throw new Error("The Client API returned an invalid response.");
  }

  return result.data.client;
}

export async function createClient(
  input: CreateClientInput,
): Promise<Client> {
  const response = await trackedFetch(
    "create_client",
    "/api/clients",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Failed to create Client. HTTP ${response.status}.`,
      ),
    );
  }

  const payload: unknown = await response.json();
  const result = clientResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid Client creation response:", result.error);
    throw new Error("The Client API returned an invalid response.");
  }

  return result.data.client;
}
