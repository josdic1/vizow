import {
  clientsResponseSchema,
  type Client,
} from "@vizow/shared";

export async function fetchClients(signal?: AbortSignal): Promise<Client[]> {
  const response = await fetch("/api/clients", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load clients. HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const result = clientsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid /api/clients response:", result.error);
    throw new Error("The clients API returned an invalid response.");
  }

  return result.data.clients;
}
