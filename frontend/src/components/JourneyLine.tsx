import { useEffect, useMemo, useState } from "react";
import type { Job, JobJourneyEvent } from "@vizow/shared";

/* ============================================================
   JourneyLine
   Reads the Journey event stream and draws it as a transit line.
   The open ring marks where the Job is right now: the last thing
   that actually happened. Everything right of it is plan.

   Every stop is selectable. Choosing one opens a panel below the
   line holding every event recorded there. Choose the same stop
   again, press Escape, or use Close to dismiss it.

   Pure function of the events the Journey card already loaded.
   No new API calls.
   ============================================================ */

type StationState = "done" | "live" | "plan" | "void";

type Waypoint = {
  key: string;
  label: string;
  date: string | null;
  note: string | null;
  events: JobJourneyEvent[];
  cycleNumber: number | null;
};

type Station = Waypoint & {
  state: StationState;
};

type Branch = Waypoint & {
  atIndex: number;
  direction: 1 | -1;
  tone: "change" | "block";
  depth: number;
};

type JourneyLineModel = {
  stations: Station[];
  branches: Branch[];
  liveIndex: number;
  orphanEvents: JobJourneyEvent[];
};

const VISIT_EVENTS = new Set([
  "visit_scheduled",
  "visit_completed",
  "visit_cancelled",
]);

/* Notes, photos and documents do not earn a stop of their own.
   They attach to whichever waypoint was open at the time, so
   selecting that stop shows everything recorded there. */
const ATTACHED_EVENTS = new Set([
  "field_note_created",
  "photo_uploaded",
  "vow_created",
  "scope_revision_visit_linked",
]);

/* ── safe detail readers ───────────────────────────────────── */

function record(
  value: unknown,
): Record<string, unknown> | null {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return null;
}

function text(
  source: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!source) {
    return null;
  }

  const value = source[key];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function amount(
  source: Record<string, unknown> | null,
  key: string,
): number {
  if (!source) {
    return 0;
  }

  const value = Number(source[key]);

  return Number.isFinite(value) ? value : 0;
}

/* ── formatting ────────────────────────────────────────────── */

export function formatStationDate(
  value: string | null,
): string {
  if (!value) {
    return "TBD";
  }

  return new Date(value)
    .toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
    })
    .toUpperCase();
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDelta(value: number): string {
  const sign = value < 0 ? "\u2212" : "+";

  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function formatEventType(value: string): string {
  const spaced = value.split("_").join(" ");

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function truncate(
  value: string | null,
  limit: number,
): string | null {
  if (!value) {
    return null;
  }

  return value.length > limit
    ? `${value.slice(0, limit - 1)}\u2026`
    : value;
}

function describeWaypointContents(
  events: JobJourneyEvent[],
): string {
  const counts = new Map<string, number>();

  for (const event of events) {
    const label =
      event.eventType === "photo_uploaded"
        ? "photo"
        : event.eventType === "field_note_created"
          ? "note"
          : VISIT_EVENTS.has(event.eventType)
            ? "visit update"
            : event.eventType.startsWith("scope_revision")
              ? "scope change"
              : event.eventType === "vow_created"
                ? "VOW"
                : "record";

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .slice(0, 3)
    .map(([label, count]) =>
      `${count} ${label}${count === 1 ? "" : "s"}`,
    )
    .join(" · ");
}

/* Pull the readable facts out of one event's details. */
export function describeEvent(
  event: JobJourneyEvent,
): Array<{ label: string; value: string }> {
  const details = record(event.details);
  const rows: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();

  const push = (label: string, value: string | null) => {
    if (value && !seen.has(label)) {
      seen.add(label);
      rows.push({ label, value });
    }
  };

  const visit = record(details?.visit);
  const scheduledStart = text(visit, "scheduledStart");

  push("Status", text(visit, "status"));
  push(
    "Scheduled",
    scheduledStart ? formatTimestamp(scheduledStart) : null,
  );
  push("Visit notes", text(visit, "notes"));

  const revision = record(details?.scopeRevision);

  if (revision) {
    push(
      "Revision",
      `Number ${amount(revision, "revisionNumber")}`,
    );
    push(
      "Price change",
      formatDelta(amount(revision, "priceChange")),
    );
    push("Reason", text(revision, "reason"));
    push("Scope", text(revision, "scopeText"));
    push(
      "Visit requirement",
      text(revision, "visitRequirement"),
    );
  }

  push("Note", text(record(details?.fieldNote), "content"));

  const photo = record(details?.photo);
  push("Photo stage", text(photo, "stage"));
  push("Caption", text(photo, "caption"));

  const closure = record(details?.closure);

  if (closure) {
    const finalPrice = amount(closure, "finalPrice");

    push(
      "Final price",
      finalPrice
        ? `$${finalPrice.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })}`
        : null,
    );
    push("Completed", text(closure, "completionDate"));
    push("Closure notes", text(closure, "notes"));
  }

  const vow = record(details?.vow);
  push("Document", text(vow, "title"));
  push("Document status", text(vow, "status"));

  push("Reason", text(details, "reason"));
  push("Decline reason", text(details, "declineReason"));
  push(
    "Cancellation reason",
    text(details, "cancellationReason"),
  );

  return rows;
}

/* ── model ─────────────────────────────────────────────────── */

export function buildJourneyLine(
  events: JobJourneyEvent[],
  job: Job,
): JourneyLineModel {
  const ordered = [...events].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() -
      new Date(right.createdAt).getTime(),
  );

  const cycleNumbers = new Map<string, number>();
  for (const event of ordered) {
    if (event.jobCycleId && !cycleNumbers.has(event.jobCycleId)) {
      cycleNumbers.set(event.jobCycleId, cycleNumbers.size + 1);
    }
  }

  const eventCycle = (event: JobJourneyEvent): number | null =>
    event.jobCycleId ? cycleNumbers.get(event.jobCycleId) ?? null : null;

  const stations: Station[] = [];
  const visitStations = new Map<string, Station>();
  const pendingBranches: Array<Branch & { at: string }> =
    [];
  const orphanEvents: JobJourneyEvent[] = [];

  let openWaypoint: Waypoint | null = null;

  function openStation(station: Station): Station {
    stations.push(station);
    openWaypoint = station;
    return station;
  }

  function openBranch(
    branch: Branch & { at: string },
  ): void {
    pendingBranches.push(branch);
    openWaypoint = branch;
  }

  for (const event of ordered) {
    const details = record(event.details);

    if (ATTACHED_EVENTS.has(event.eventType)) {
      if (openWaypoint) {
        openWaypoint.events.push(event);
      } else {
        orphanEvents.push(event);
      }

      continue;
    }

    if (event.eventType === "job_created") {
      openStation({
        key: event.id,
        label: "Opened",
        date: event.createdAt,
        state: "done",
        note: "Job created",
        events: [event],
        cycleNumber: eventCycle(event) ?? 1,
      });
      continue;
    }

    if (event.eventType === "cycle_reopened") {
      openStation({
        key: event.id,
        label: "Reopened",
        date: event.createdAt,
        state: "done",
        note: text(details, "reason"),
        events: [event],
        cycleNumber: eventCycle(event),
      });
      continue;
    }

    if (VISIT_EVENTS.has(event.eventType)) {
      const visitId = text(details, "visitId") ?? event.id;
      const visit = record(details?.visit);
      const status = text(visit, "status") ?? "scheduled";
      const scheduled =
        text(visit, "scheduledStart") ??
        text(details, "scheduledStart") ??
        event.createdAt;

      const state: StationState =
        status === "completed"
          ? "done"
          : status === "cancelled"
            ? "void"
            : "plan";

      const existing = visitStations.get(visitId);

      if (existing) {
        existing.state = state;
        existing.date = scheduled;
        existing.note =
          truncate(text(visit, "notes"), 68) ??
          existing.note;
        existing.events.push(event);
        openWaypoint = existing;
      } else {
        const station = openStation({
          key: visitId,
          label: `Visit ${visitStations.size + 1}`,
          date: scheduled,
          state,
          note: truncate(text(visit, "notes"), 68),
          events: [event],
          cycleNumber: eventCycle(event),
        });

        visitStations.set(visitId, station);
      }

      continue;
    }

    if (
      event.eventType === "cycle_closed" ||
      event.eventType === "cycle_completed"
    ) {
      const closure = record(details?.closure);

      openStation({
        key: event.id,
        label: "Closed",
        date:
          text(closure, "completionDate") ??
          event.createdAt,
        state: "done",
        note: truncate(text(closure, "notes"), 68),
        events: [event],
        cycleNumber: eventCycle(event),
      });
      continue;
    }

    if (event.eventType === "job_cancelled") {
      openStation({
        key: event.id,
        label: "Cancelled",
        date: event.createdAt,
        state: "void",
        note: truncate(
          text(details, "cancellationReason") ??
            text(details, "reason"),
          68,
        ),
        events: [event],
        cycleNumber: eventCycle(event),
      });
      continue;
    }

    if (event.eventType === "scope_revision_created") {
      const revision = record(details?.scopeRevision);
      const number = amount(revision, "revisionNumber");
      const change = amount(revision, "priceChange");

      openBranch({
        key: event.id,
        at: event.createdAt,
        atIndex: 0,
        depth: 0,
        direction: 1,
        tone: "change",
        label: `Rev ${
          number || "\u2014"
        } \u00b7 ${formatDelta(change)}`,
        date: event.createdAt,
        note: truncate(text(revision, "reason"), 68),
        events: [event],
        cycleNumber: eventCycle(event),
      });
      continue;
    }

    if (
      event.eventType ===
      "scope_revision_visit_plan_resolved"
    ) {
      const revision = record(details?.scopeRevision);
      const held =
        text(revision, "visitRequirement") ===
          "undecided" ||
        text(details, "visitRequirement") === "undecided";

      if (held) {
        openBranch({
          key: event.id,
          at: event.createdAt,
          atIndex: 0,
          depth: 0,
          direction: -1,
          tone: "block",
          label: "Held \u00b7 visit undecided",
          date: event.createdAt,
          note: truncate(text(revision, "reason"), 68),
          events: [event],
          cycleNumber: eventCycle(event),
        });
      } else if (openWaypoint) {
        openWaypoint.events.push(event);
      }

      continue;
    }

    if (event.eventType === "request_declined") {
      openBranch({
        key: event.id,
        at: event.createdAt,
        atIndex: 0,
        depth: 0,
        direction: -1,
        tone: "block",
        label: "Request declined",
        date: event.createdAt,
        note: truncate(
          text(details, "declineReason") ??
            text(details, "reason"),
          68,
        ),
        events: [event],
        cycleNumber: eventCycle(event),
      });
      continue;
    }

    /* Anything unrecognised still belongs somewhere. */
    if (openWaypoint) {
      openWaypoint.events.push(event);
    } else {
      orphanEvents.push(event);
    }
  }

  stations.sort((left, right) => {
    if (!left.date) {
      return 1;
    }

    if (!right.date) {
      return -1;
    }

    return (
      new Date(left.date).getTime() -
      new Date(right.date).getTime()
    );
  });

  if (stations.length === 0) {
    stations.push({
      key: "job-opened",
      label: "Opened",
      date: job.createdAt,
      state: "done",
      note: "Job created",
      events: orphanEvents.splice(0),
      cycleNumber: 1,
    });
  }

  const isClosed = stations.some(
    (station) =>
      station.label === "Closed" ||
      station.label === "Cancelled",
  );

  if (!isClosed) {
    stations.push({
      key: "terminus",
      label: "Close out",
      date: null,
      state: "plan",
      note:
        job.currentCycle.stage === "completed"
          ? "Cycle complete"
          : "Awaiting the final visit",
      events: [],
      cycleNumber: job.currentCycle.cycleNumber,
    });
  }

  /* You are here: the last stop that actually happened. */
  let liveIndex = -1;

  stations.forEach((station, index) => {
    if (station.state === "done") {
      liveIndex = index;
    }
  });

  if (liveIndex > -1) {
    stations[liveIndex].state = "live";
  }

  /* Branches attach to the nearest preceding stop, then stack
     outward so two on the same stop never overlap. */
  const stackCount = new Map<string, number>();

  const branches: Branch[] = pendingBranches.map(
    (branch) => {
      let atIndex = 0;

      stations.forEach((station, index) => {
        if (
          station.date &&
          new Date(station.date).getTime() <=
            new Date(branch.at).getTime()
        ) {
          atIndex = index;
        }
      });

      const slot = `${atIndex}:${branch.direction}`;
      const depth = stackCount.get(slot) ?? 0;
      stackCount.set(slot, depth + 1);

      return {
        key: branch.key,
        atIndex,
        depth,
        direction: branch.direction,
        tone: branch.tone,
        label: branch.label,
        date: branch.date,
        note: branch.note,
        events: branch.events,
        cycleNumber: branch.cycleNumber,
      };
    },
  );

  return { stations, branches, liveIndex, orphanEvents };
}

/* ── geometry ─────────────────────────────────────────────── */

const GAP = 132;
const X0 = 66;
const Y = 104;
const PAD_RIGHT = 96;
const BRANCH_RUN = 124;
const BRANCH_LEN = 150;
const BRANCH_STACK = 46;

const SIGNAL: Record<StationState, string> = {
  done: "var(--signal-done)",
  live: "var(--signal-live)",
  plan: "var(--signal-plan)",
  void: "var(--signal-idle)",
};

const STATE_TAG: Record<StationState, string> = {
  done: "Complete",
  live: "Current",
  plan: "Scheduled",
  void: "Cancelled",
};

type Selection = {
  kind: "station" | "branch";
  key: string;
};

type JourneyLineProps = {
  events: JobJourneyEvent[];
  job: Job;
};

export function JourneyLine({
  events,
  job,
}: JourneyLineProps) {
  const [runKey, setRunKey] = useState(0);
  const [selection, setSelection] =
    useState<Selection | null>(null);
  const [preview, setPreview] =
    useState<Selection | null>(null);

  const line = useMemo(
    () => buildJourneyLine(events, job),
    [events, job],
  );

  useEffect(() => {
    if (!selection) {
      return;
    }

    function handleKey(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") {
        setSelection(null);
      }
    }

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [selection]);

  const { stations, branches, liveIndex } = line;

  if (stations.length < 2) {
    return null;
  }

  const selectedStation =
    selection?.kind === "station"
      ? stations.find(
          (station) => station.key === selection.key,
        )
      : undefined;

  const selectedBranch =
    selection?.kind === "branch"
      ? branches.find(
          (branch) => branch.key === selection.key,
        )
      : undefined;

  const selected: Waypoint | undefined =
    selectedStation ?? selectedBranch;

  const previewStation =
    preview?.kind === "station"
      ? stations.find((station) => station.key === preview.key)
      : undefined;
  const previewBranch =
    preview?.kind === "branch"
      ? branches.find((branch) => branch.key === preview.key)
      : undefined;
  const previewWaypoint: Waypoint | undefined =
    previewStation ?? previewBranch;

  function toggle(kind: Selection["kind"], key: string) {
    setSelection((current) =>
      current &&
      current.kind === kind &&
      current.key === key
        ? null
        : { kind, key },
    );
  }

  function keyActivate(
    keyEvent: React.KeyboardEvent,
    kind: Selection["kind"],
    key: string,
  ) {
    if (keyEvent.key === "Enter" || keyEvent.key === " ") {
      keyEvent.preventDefault();
      toggle(kind, key);
    }
  }

  const downDepth = branches
    .filter((branch) => branch.direction > 0)
    .reduce(
      (deepest, branch) =>
        Math.max(deepest, branch.depth + 1),
      0,
    );

  const upDepth = branches
    .filter((branch) => branch.direction < 0)
    .reduce(
      (deepest, branch) =>
        Math.max(deepest, branch.depth + 1),
      0,
    );

  const topPad = Math.max(
    0,
    (upDepth ? BRANCH_RUN + (upDepth - 1) * BRANCH_STACK + 46 : 0) -
      Y +
      20,
  );

  const bottomPad = downDepth
    ? BRANCH_RUN + (downDepth - 1) * BRANCH_STACK + 54
    : 0;

  const height =
    Y + Math.max(88, bottomPad) + 24 + topPad;

  const width =
    X0 + (stations.length - 1) * GAP + PAD_RIGHT;
  const stationX = (index: number) => X0 + index * GAP;

  const cycleGroups = stations.reduce<Array<{
    number: number;
    start: number;
    end: number;
  }>>((groups, station, index) => {
    const number = station.cycleNumber ?? job.currentCycle.cycleNumber;
    const last = groups.at(-1);

    if (last && last.number === number) {
      last.end = index;
    } else {
      groups.push({ number, start: index, end: index });
    }

    return groups;
  }, []);

  const previewAnchorX = previewStation
    ? stationX(stations.indexOf(previewStation))
    : previewBranch
      ? stationX(previewBranch.atIndex) +
        BRANCH_RUN +
        previewBranch.depth * BRANCH_STACK +
        BRANCH_LEN
      : 0;
  const previewX = Math.max(
    8,
    Math.min(previewAnchorX - 126, width - 260),
  );
  const previewState = previewStation
    ? STATE_TAG[previewStation.state]
    : previewBranch?.tone === "block"
      ? "Held"
      : "Change order";

  const current =
    liveIndex > -1 ? stations[liveIndex] : null;
  const next =
    stations.find((station) => station.state === "plan") ??
    null;

  return (
    <div className="journey-line">
      <div className="journey-line-topline">
        <p className="journey-line-position">
          {current ? (
            <>
              <span>Now at</span>
              <strong>{current.label}</strong>
              <span>
                {formatStationDate(current.date)}
              </span>
            </>
          ) : (
            <span>Not started</span>
          )}

          {next && (
            <>
              <span className="journey-line-arrow">
                &rarr;
              </span>
              <span>Next</span>
              <strong>{next.label}</strong>
              <span>{formatStationDate(next.date)}</span>
            </>
          )}
        </p>

        <button
          className="journey-line-replay"
          type="button"
          onClick={() => {
            setSelection(null);
            setRunKey((value) => value + 1);
          }}
        >
          Replay
        </button>
      </div>

      <p className="journey-line-hint">
        Select any stop to see what was recorded there.
      </p>

      <div className="journey-line-scroll">
        <svg
          className="journey-line-svg"
          key={runKey}
          viewBox={`0 ${-topPad} ${width} ${height}`}
          style={{ width: `${width}px`, minWidth: `${width}px` }}
          role="group"
          aria-label="Job journey line"
        >
          {cycleGroups.map((cycle) => {
            const startX = stationX(cycle.start);
            const endX = stationX(cycle.end);
            const labelX = (startX + endX) / 2;

            return (
              <g className="journey-cycle" key={`cycle-${cycle.number}`}>
                <line
                  x1={startX}
                  x2={Math.max(startX + 34, endX)}
                  y1={34}
                  y2={34}
                />
                <text x={labelX} y={22} textAnchor="middle">
                  CYCLE {cycle.number}
                </text>
              </g>
            );
          })}

          {stations.slice(0, -1).map((station, index) => {
            const ahead = stations[index + 1];
            const tone =
              ahead.state === "live"
                ? station.state
                : ahead.state;

            return (
              <path
                className="journey-seg"
                key={`seg-${station.key}`}
                d={`M${stationX(index)} ${Y} H${stationX(
                  index + 1,
                )}`}
                pathLength={1}
                stroke={SIGNAL[tone]}
                style={{
                  ["--t" as string]: `${(
                    0.3 +
                    index * 0.16
                  ).toFixed(2)}s`,
                }}
              />
            );
          })}

          {branches.map((branch) => {
            const x = stationX(branch.atIndex);
            const run =
              BRANCH_RUN + branch.depth * BRANCH_STACK;
            const y = Y + branch.direction * run;
            const endX = x + run + BRANCH_LEN;
            const delay =
              0.3 + branch.atIndex * 0.16 + 0.3;
            const stroke =
              branch.tone === "block"
                ? "var(--signal-block)"
                : "var(--signal-change)";
            const labelFill =
              branch.tone === "block"
                ? "var(--signal-block-on)"
                : "var(--signal-change)";
            const isOpen =
              selectedBranch?.key === branch.key;

            return (
              <g
                className={`journey-hit${
                  isOpen ? " is-open" : ""
                }`}
                key={branch.key}
                role="button"
                tabIndex={0}
                aria-pressed={isOpen}
                aria-label={`${branch.label}, ${branch.events.length} recorded. Select for details.`}
                onClick={() =>
                  toggle("branch", branch.key)
                }
                onMouseEnter={() =>
                  setPreview({ kind: "branch", key: branch.key })
                }
                onMouseLeave={() => setPreview(null)}
                onFocus={() =>
                  setPreview({ kind: "branch", key: branch.key })
                }
                onBlur={() => setPreview(null)}
                onKeyDown={(keyEvent) =>
                  keyActivate(
                    keyEvent,
                    "branch",
                    branch.key,
                  )
                }
              >
                <path
                  className="journey-branch"
                  d={`M${x} ${Y} L${x + run} ${y} H${endX}`}
                  pathLength={1}
                  stroke={stroke}
                  style={{
                    ["--t" as string]: `${delay.toFixed(
                      2,
                    )}s`,
                  }}
                />

                {isOpen && (
                  <circle
                    className="journey-selected"
                    cx={endX}
                    cy={y}
                    r={19}
                    stroke={stroke}
                  />
                )}

                <circle
                  className="journey-node-small journey-pop"
                  cx={endX}
                  cy={y}
                  r={11}
                  stroke={stroke}
                  style={{
                    ["--t" as string]: `${(
                      delay + 0.34
                    ).toFixed(2)}s`,
                  }}
                />

                <circle
                  className="journey-target"
                  cx={endX}
                  cy={y}
                  r={26}
                />

                <text
                  className="journey-branch-label journey-fade"
                  x={endX}
                  y={
                    branch.direction > 0 ? y + 32 : y - 24
                  }
                  textAnchor="end"
                  fill={labelFill}
                  style={{
                    ["--t" as string]: `${(
                      delay + 0.34
                    ).toFixed(2)}s`,
                  }}
                >
                  {branch.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {stations.map((station, index) => {
            const delay = 0.3 + index * 0.16;
            const x = stationX(index);
            const isLive = station.state === "live";
            const isOpen =
              selectedStation?.key === station.key;

            return (
              <g
                className={`journey-hit${
                  isOpen ? " is-open" : ""
                }`}
                key={station.key}
                role="button"
                tabIndex={0}
                aria-pressed={isOpen}
                aria-label={`${station.label}, ${
                  STATE_TAG[station.state]
                }, ${formatStationDate(station.date)}, ${
                  station.events.length
                } recorded. Select for details.`}
                onClick={() =>
                  toggle("station", station.key)
                }
                onMouseEnter={() =>
                  setPreview({ kind: "station", key: station.key })
                }
                onMouseLeave={() => setPreview(null)}
                onFocus={() =>
                  setPreview({ kind: "station", key: station.key })
                }
                onBlur={() => setPreview(null)}
                onKeyDown={(keyEvent) =>
                  keyActivate(
                    keyEvent,
                    "station",
                    station.key,
                  )
                }
              >
                {isOpen && (
                  <circle
                    className="journey-selected"
                    cx={x}
                    cy={Y}
                    r={isLive ? 28 : 22}
                    stroke={SIGNAL[station.state]}
                  />
                )}

                <circle
                  className="journey-node journey-pop"
                  cx={x}
                  cy={Y}
                  r={13}
                  stroke={
                    station.state === "void"
                      ? "var(--signal-idle)"
                      : "var(--ink)"
                  }
                  style={{
                    ["--t" as string]: `${delay.toFixed(
                      2,
                    )}s`,
                  }}
                />

                {isLive && (
                  <circle
                    className="journey-ring"
                    cx={x}
                    cy={Y}
                    r={20}
                    style={{
                      ["--t" as string]: `${(
                        delay + 0.08
                      ).toFixed(2)}s`,
                    }}
                  />
                )}

                {station.events.length > 1 && (
                  <text
                    className="journey-count journey-fade"
                    x={x}
                    y={Y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      ["--t" as string]: `${(
                        delay + 0.2
                      ).toFixed(2)}s`,
                    }}
                  >
                    {station.events.length}
                  </text>
                )}

                <circle
                  className="journey-target"
                  cx={x}
                  cy={Y}
                  r={32}
                />

                <text
                  className="journey-station-label journey-fade"
                  x={x}
                  y={Y + 46}
                  textAnchor="middle"
                  fill={
                    isLive
                      ? "var(--signal-live)"
                      : station.state === "void"
                        ? "var(--signal-idle)"
                        : "var(--ink)"
                  }
                  style={{
                    ["--t" as string]: `${(
                      delay + 0.08
                    ).toFixed(2)}s`,
                  }}
                >
                  {station.label.toUpperCase()}
                </text>

                <text
                  className="journey-station-date journey-fade"
                  x={x}
                  y={Y + 66}
                  textAnchor="middle"
                  fill={
                    isLive
                      ? "var(--signal-live)"
                      : "var(--ink-dim)"
                  }
                  style={{
                    ["--t" as string]: `${(
                      delay + 0.12
                    ).toFixed(2)}s`,
                  }}
                >
                  {formatStationDate(station.date)}
                  {isLive ? " \u00b7 NOW" : ""}
                </text>
              </g>
            );
          })}

          {previewWaypoint && (
            <g
              className="journey-tooltip"
              aria-hidden="true"
              pointerEvents="none"
            >
              <rect
                x={previewX}
                y={6}
                width={252}
                height={82}
              />
              <text
                className="journey-tooltip-title"
                x={previewX + 12}
                y={27}
              >
                {truncate(previewWaypoint.label, 30)}
              </text>
              <text
                className="journey-tooltip-meta"
                x={previewX + 12}
                y={47}
              >
                {previewState.toUpperCase()}
                {" · "}
                {formatStationDate(previewWaypoint.date)}
              </text>
              <text
                className="journey-tooltip-contents"
                x={previewX + 12}
                y={69}
              >
                {truncate(
                  describeWaypointContents(previewWaypoint.events) ||
                    "Nothing recorded yet",
                  38,
                )}
              </text>
            </g>
          )}
        </svg>
      </div>

      {selected && (
        <section
          className={`journey-panel journey-panel-${
            selectedBranch
              ? selectedBranch.tone
              : (selectedStation?.state ?? "plan")
          }`}
          aria-label={`${selected.label} details`}
        >
          <div className="journey-panel-head">
            <div>
              <p className="journey-panel-eyebrow">
                {selectedBranch
                  ? selectedBranch.tone === "block"
                    ? "Held"
                    : "Change order"
                  : STATE_TAG[
                      selectedStation?.state ?? "plan"
                    ]}
                {" \u00b7 "}
                {formatStationDate(selected.date)}
              </p>

              <h3>{selected.label}</h3>

              {selected.note && (
                <p className="journey-panel-note">
                  {selected.note}
                </p>
              )}
            </div>

            <button
              className="journey-panel-close"
              type="button"
              onClick={() => setSelection(null)}
            >
              Close
            </button>
          </div>

          {selected.events.length === 0 ? (
            <p className="journey-panel-empty">
              Nothing has been recorded here yet.
            </p>
          ) : (
            <ol className="journey-panel-events">
              {selected.events.map((event) => {
                const rows = describeEvent(event);
                const photo = record(
                  record(event.details)?.photo,
                );
                const photoUrl = text(photo, "url");
                const photoCaption = text(photo, "caption");

                return (
                  <li key={event.id}>
                    <div className="journey-panel-event-head">
                      <strong>
                        {formatEventType(event.eventType)}
                      </strong>
                      <small>
                        {formatTimestamp(event.createdAt)}
                      </small>
                    </div>

                    {photoUrl && (
                      <figure className="journey-panel-photo">
                        <a
                          href={photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open photo at full size"
                        >
                          <img
                            src={photoUrl}
                            alt={
                              photoCaption ??
                              `${text(photo, "stage") ?? "Job"} photo`
                            }
                          />
                        </a>

                        {photoCaption && (
                          <figcaption>{photoCaption}</figcaption>
                        )}
                      </figure>
                    )}

                    {rows.length > 0 && (
                      <dl>
                        {rows.map((row) => (
                          <div
                            key={`${event.id}-${row.label}`}
                          >
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      <div className="journey-line-key">
        <span>
          <i style={{ background: "var(--signal-done)" }} />
          Complete
        </span>
        <span>
          <i style={{ background: "var(--signal-live)" }} />
          Current
        </span>
        <span>
          <i style={{ background: "var(--signal-plan)" }} />
          Scheduled
        </span>
        <span>
          <i
            style={{ background: "var(--signal-change)" }}
          />
          Change order
        </span>
        <span>
          <i style={{ background: "var(--signal-block)" }} />
          Held
        </span>
      </div>
    </div>
  );
}
