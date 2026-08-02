import {
  operationPlans,
  operationResponseSchema,
  type OperationKind,
  type OperationTrace,
} from "@vizow/shared";

type OperationSnapshot = {
  operation: OperationTrace | null;
};

type Listener = () => void;

let snapshot: OperationSnapshot = {
  operation: null,
};

const listeners = new Set<Listener>();

function publish(operation: OperationTrace | null): void {
  snapshot = { operation };

  for (const listener of listeners) {
    listener();
  }
}

function localStartingTrace(
  id: string,
  kind: OperationKind,
): OperationTrace {
  const now = new Date().toISOString();

  return {
    id,
    kind,
    status: "working",
    checkpointKey: null,
    checkpointLabel: "Sending to server",
    reached: 0,
    total: operationPlans[kind].length,
    message: "Sending this operation to the VIZOW server.",
    failureAt: null,
    checkpoints: [],
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

function localNetworkFailure(
  operation: OperationTrace,
): OperationTrace {
  const now = new Date().toISOString();

  return {
    ...operation,
    status: "error",
    checkpointLabel: "Server not reached",
    message:
      "The server could not be reached. No server-side change was confirmed.",
    completedAt: now,
    updatedAt: now,
  };
}

async function fetchOperation(
  operationId: string,
): Promise<OperationTrace | null> {
  const response = await fetch(
    `/api/operations/${encodeURIComponent(operationId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Unable to read operation trace. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = operationResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid operation trace response:", result.error);
    throw new Error("The operation API returned an invalid response.");
  }

  return result.data.operation;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function pollOperation(
  operationId: string,
  shouldStop: () => boolean,
): Promise<void> {
  while (!shouldStop()) {
    try {
      const operation = await fetchOperation(operationId);

      if (operation) {
        publish(operation);

        if (operation.status !== "working") {
          return;
        }
      }
    } catch (error) {
      console.error(error);
    }

    await wait(120);
  }
}

export function subscribeToOperationStore(
  listener: Listener,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getOperationSnapshot(): OperationSnapshot {
  return snapshot;
}

export async function trackedFetch(
  kind: OperationKind,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const operationId = crypto.randomUUID();
  const startingTrace = localStartingTrace(operationId, kind);

  publish(startingTrace);

  let pollingStopped = false;

  const polling = pollOperation(
    operationId,
    () => pollingStopped,
  );

  const headers = new Headers(init.headers);
  headers.set("X-VIZOW-Operation-ID", operationId);

  try {
    const response = await fetch(input, {
      ...init,
      headers,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const operation = await fetchOperation(operationId);

      if (operation) {
        publish(operation);

        if (operation.status !== "working") {
          break;
        }
      }

      await wait(50);
    }

    pollingStopped = true;
    await polling;

    return response;
  } catch (error) {
    pollingStopped = true;
    await polling;

    publish(localNetworkFailure(startingTrace));
    throw error;
  }
}
