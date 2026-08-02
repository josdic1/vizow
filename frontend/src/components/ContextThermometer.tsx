import {
  operationPlans,
  type OperationTrace,
} from "@vizow/shared";
import { useSyncExternalStore } from "react";

import {
  getOperationSnapshot,
  subscribeToOperationStore,
} from "../operations/operationStore";
import "./ContextThermometer.css";

function statusText(operation: OperationTrace | null): string {
  if (!operation) {
    return "No active operation";
  }

  if (operation.status === "success") {
    return `Server confirmed · ${operation.reached}/${operation.total}`;
  }

  return `${operation.checkpointLabel} · ${operation.reached}/${operation.total}`;
}

export function ContextThermometer() {
  const { operation } = useSyncExternalStore(
    subscribeToOperationStore,
    getOperationSnapshot,
    getOperationSnapshot,
  );

  const plan = operation
    ? operationPlans[operation.kind]
    : [];

  const completedKeys = new Set(
    operation?.checkpoints.map((checkpoint) => checkpoint.key) ?? [],
  );

  const fillPercentage = operation
    ? (operation.reached / operation.total) * 100
    : 0;

  const classes = [
    "context-thermometer",
    operation
      ? `context-thermometer--${operation.status}`
      : "context-thermometer--idle",
  ].join(" ");

  return (
    <section
      className={classes}
      aria-label="VIZOW server operation trace"
      aria-live="polite"
    >
      <span className="context-thermometer__name">
        Server Trace
      </span>

      <div
        className="context-thermometer__gauge"
        title={operation?.message ?? "No active server operation."}
      >
        <span
          className="context-thermometer__fill"
          style={{ width: `${fillPercentage}%` }}
        />

        {plan.map((checkpoint, index) => {
          const failed =
            operation?.failureAt === checkpoint.key;

          const completed = completedKeys.has(checkpoint.key);

          const tickClasses = [
            "context-thermometer__tick",
            completed
              ? "context-thermometer__tick--completed"
              : "",
            failed
              ? "context-thermometer__tick--failed"
              : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              aria-hidden="true"
              className={tickClasses}
              key={checkpoint.key}
              style={{
                left: `${((index + 1) / plan.length) * 100}%`,
              }}
              title={checkpoint.label}
            />
          );
        })}
      </div>

      <span
        className="context-thermometer__status"
        title={operation?.message}
      >
        {statusText(operation)}
      </span>
    </section>
  );
}
