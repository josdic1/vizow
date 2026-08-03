import {
  clientRecordResponseSchema,
  clientResponseSchema,
  clientsResponseSchema,
  type Client,
  type ClientRecord,
  type CreateClientInput,
  type CreateClientPropertyInput,
  type OperationKind,
  type UpdateClientInput,
  type UpdateClientPropertyInput,
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

async function readClientRecord(
  response: Response,
  fallback: string,
): Promise<ClientRecord> {
  if (!response.ok) {
    throw new Error(
      await readApiError(response, fallback),
    );
  }

  const payload: unknown = await response.json();
  const result =
    clientRecordResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid Client record response:",
      result.error,
    );

    throw new Error(
      "The Client API returned an invalid record.",
    );
  }

  return result.data.client;
}

async function trackedClientRecordRequest(
  operationKind: OperationKind,
  url: string,
  options: {
    method: "POST" | "PATCH";
    body?: unknown;
  },
  fallback: string,
): Promise<ClientRecord> {
  const response = await trackedFetch(
    operationKind,
    url,
    {
      method: options.method,
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : {
              "Content-Type": "application/json",
            }),
      },
      ...(options.body === undefined
        ? {}
        : {
            body: JSON.stringify(options.body),
          }),
    },
  );

  return readClientRecord(response, fallback);
}

export async function fetchClients(
  signal?: AbortSignal,
  includeArchived = false,
): Promise<Client[]> {
  const query = includeArchived
    ? "?includeArchived=true"
    : "";

  const response = await fetch(
    `/api/clients${query}`,
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
      `Failed to load Clients. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = clientsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error(
      "Invalid /api/clients response:",
      result.error,
    );

    throw new Error(
      "The Clients API returned an invalid response.",
    );
  }

  return result.data.clients;
}

export async function fetchClient(
  clientId: string,
  signal?: AbortSignal,
): Promise<ClientRecord> {
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

  return readClientRecord(
    response,
    `Failed to load Client. HTTP ${response.status}.`,
  );
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
    console.error(
      "Invalid Client creation response:",
      result.error,
    );

    throw new Error(
      "The Client API returned an invalid response.",
    );
  }

  return result.data.client;
}

export function updateClient(
  clientId: string,
  input: UpdateClientInput,
): Promise<ClientRecord> {
  return trackedClientRecordRequest(
    "update_client",
    `/api/clients/${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      body: input,
    },
    "Unable to update Client.",
  );
}

export function archiveClient(
  clientId: string,
): Promise<ClientRecord> {
  return trackedClientRecordRequest(
    "archive_client",
    `/api/clients/${encodeURIComponent(clientId)}/archive`,
    {
      method: "POST",
    },
    "Unable to archive Client.",
  );
}

export function restoreClient(
  clientId: string,
): Promise<ClientRecord> {
  return trackedClientRecordRequest(
    "restore_client",
    `/api/clients/${encodeURIComponent(clientId)}/restore`,
    {
      method: "POST",
    },
    "Unable to restore Client.",
  );
}

export function createClientProperty(
  clientId: string,
  input: CreateClientPropertyInput,
): Promise<ClientRecord> {
  return trackedClientRecordRequest(
    "create_client_property",
    `/api/clients/${encodeURIComponent(clientId)}/properties`,
    {
      method: "POST",
      body: input,
    },
    "Unable to add Property.",
  );
}

export function updateClientProperty(
  clientId: string,
  propertyId: string,
  input: UpdateClientPropertyInput,
): Promise<ClientRecord> {
  return trackedClientRecordRequest(
    "update_client_property",
    [
      "/api/clients",
      encodeURIComponent(clientId),
      "properties",
      encodeURIComponent(propertyId),
    ].join("/"),
    {
      method: "PATCH",
      body: input,
    },
    "Unable to update Property.",
  );
}

export function archiveClientProperty(
  clientId: string,
  propertyId: string,
): Promise<ClientRecord> {
  return trackedClientRecordRequest(
    "archive_client_property",
    [
      "/api/clients",
      encodeURIComponent(clientId),
      "properties",
      encodeURIComponent(propertyId),
      "archive",
    ].join("/"),
    {
      method: "POST",
    },
    "Unable to archive Property.",
  );
}

export function restoreClientProperty(
  clientId: string,
  propertyId: string,
): Promise<ClientRecord> {
  return trackedClientRecordRequest(
    "restore_client_property",
    [
      "/api/clients",
      encodeURIComponent(clientId),
      "properties",
      encodeURIComponent(propertyId),
      "restore",
    ].join("/"),
    {
      method: "POST",
    },
    "Unable to restore Property.",
  );
}

export function setDefaultClientProperty(
  clientId: string,
  propertyId: string,
): Promise<ClientRecord> {
  return trackedClientRecordRequest(
    "set_default_client_property",
    [
      "/api/clients",
      encodeURIComponent(clientId),
      "properties",
      encodeURIComponent(propertyId),
      "default",
    ].join("/"),
    {
      method: "POST",
    },
    "Unable to change the default Property.",
  );
}
