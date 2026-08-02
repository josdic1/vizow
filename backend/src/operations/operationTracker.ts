import {
  idSchema,
  operationPlans,
  operationTraceSchema,
  type OperationKind,
  type OperationTrace,
} from "@vizow/shared";
import type { Request } from "express";

type MutableOperationTrace = {
  id: string;
  kind: OperationKind;
  status: OperationTrace["status"];
  checkpointKey: string | null;
  checkpointLabel: string;
  reached: number;
  total: number;
  message: string;
  failureAt: string | null;
  checkpoints: Array<{
    key: string;
    label: string;
    reachedAt: Date;
  }>;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

const traces = new Map<string, MutableOperationTrace>();
const traceLifetimeMilliseconds = 30 * 60 * 1000;

function removeExpiredTraces(): void {
  const cutoff = Date.now() - traceLifetimeMilliseconds;

  for (const [id, trace] of traces) {
    if (trace.updatedAt.getTime() < cutoff) {
      traces.delete(id);
    }
  }
}

function planFor(kind: OperationKind) {
  return operationPlans[kind];
}

function checkpointFor(kind: OperationKind, key: string) {
  return planFor(kind).find((checkpoint) => checkpoint.key === key);
}

function checkpointIndex(kind: OperationKind, key: string): number {
  return planFor(kind).findIndex((checkpoint) => checkpoint.key === key);
}

function publicTrace(trace: MutableOperationTrace): OperationTrace {
  return operationTraceSchema.parse({
    ...trace,
    checkpoints: trace.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      reachedAt: checkpoint.reachedAt.toISOString(),
    })),
    startedAt: trace.startedAt.toISOString(),
    updatedAt: trace.updatedAt.toISOString(),
    completedAt: trace.completedAt?.toISOString() ?? null,
  });
}

export function operationIdFromRequest(request: Request): string | null {
  const result = idSchema.safeParse(
    request.header("x-vizow-operation-id"),
  );

  return result.success ? result.data : null;
}

export function beginOperation(
  id: string | null,
  kind: OperationKind,
  message: string,
): void {
  if (!id) {
    return;
  }

  removeExpiredTraces();

  const now = new Date();

  traces.set(id, {
    id,
    kind,
    status: "working",
    checkpointKey: null,
    checkpointLabel: "Waiting for server",
    reached: 0,
    total: planFor(kind).length,
    message,
    failureAt: null,
    checkpoints: [],
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

export function advanceOperation(
  id: string | null,
  key: string,
  message: string,
): void {
  if (!id) {
    return;
  }

  const trace = traces.get(id);

  if (!trace || trace.status !== "working") {
    return;
  }

  const checkpoint = checkpointFor(trace.kind, key);
  const index = checkpointIndex(trace.kind, key);

  if (!checkpoint || index < 0) {
    console.error(`Unknown operation checkpoint: ${trace.kind}/${key}`);
    return;
  }

  const now = new Date();

  if (!trace.checkpoints.some((item) => item.key === key)) {
    trace.checkpoints.push({
      key: checkpoint.key,
      label: checkpoint.label,
      reachedAt: now,
    });
  }

  trace.checkpointKey = checkpoint.key;
  trace.checkpointLabel = checkpoint.label;
  trace.reached = Math.max(trace.reached, index + 1);
  trace.message = message;
  trace.updatedAt = now;
}

export function completeOperation(
  id: string | null,
  message: string,
): void {
  if (!id) {
    return;
  }

  const trace = traces.get(id);

  if (!trace) {
    return;
  }

  const now = new Date();

  trace.status = "success";
  trace.message = message;
  trace.updatedAt = now;
  trace.completedAt = now;
}

export function failOperation(
  id: string | null,
  key: string | null,
  message: string,
): void {
  if (!id) {
    return;
  }

  const trace = traces.get(id);

  if (!trace) {
    return;
  }

  const now = new Date();

  if (key) {
    const checkpoint = checkpointFor(trace.kind, key);
    const index = checkpointIndex(trace.kind, key);

    if (checkpoint && index >= 0) {
      trace.checkpointKey = checkpoint.key;
      trace.checkpointLabel = `${checkpoint.label} failed`;
      trace.failureAt = checkpoint.key;
    }
  }

  trace.status = "error";
  trace.message = message;
  trace.updatedAt = now;
  trace.completedAt = now;
}

export function getOperation(id: string): OperationTrace | null {
  removeExpiredTraces();

  const trace = traces.get(id);
  return trace ? publicTrace(trace) : null;
}
