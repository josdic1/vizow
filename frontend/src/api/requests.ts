import {
  approveRequestResponseSchema,
  requestResponseSchema,
  requestsResponseSchema,
  type CreateRequestInput,
  type Job,
  type Request,
} from "@vizow/shared";

import { trackedFetch } from "../operations/operationStore";

type ApprovedRequestResult = {
  request: Request;
  job: Job;
};

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
    // Use the fallback message when the response is not JSON.
  }

  return fallback;
}

export async function fetchRequests(
  signal?: AbortSignal,
): Promise<Request[]> {
  const response = await fetch("/api/requests", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load requests. HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const result = requestsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid /api/requests response:", result.error);
    throw new Error("The requests API returned an invalid response.");
  }

  return result.data.requests;
}

export async function createRequest(
  input: CreateRequestInput,
): Promise<Request> {
  const response = await trackedFetch(
    "create_request",
    "/api/requests",
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
        `Failed to create request. HTTP ${response.status}.`,
      ),
    );
  }

  const payload: unknown = await response.json();
  const result = requestResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid Request creation response:", result.error);
    throw new Error("The requests API returned an invalid response.");
  }

  return result.data.request;
}

export async function approveRequest(
  requestId: string,
): Promise<ApprovedRequestResult> {
  const response = await trackedFetch(
    "approve_request",
    `/api/requests/${encodeURIComponent(requestId)}/approve`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Failed to approve request. HTTP ${response.status}.`,
      ),
    );
  }

  const payload: unknown = await response.json();
  const result = approveRequestResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid Request approval response:", result.error);
    throw new Error("The approval API returned an invalid response.");
  }

  return {
    request: result.data.request,
    job: result.data.job,
  };
}
