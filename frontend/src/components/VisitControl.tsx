import type { Job, Visit } from "@vizow/shared";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createVisit,
  fetchVisits,
  updateVisitStatus,
} from "../api/jobs";

type VisitControlProps = {
  job: Job;
  refreshKey: number;
};

type LoadStatus = "loading" | "ready" | "error";
type MessageTone = "success" | "error";

function formatVisitTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatVisitDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatVisitClock(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPriceChange(value: number): string {
  if (value === 0) {
    return "No price change";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    signDisplay: "always",
  }).format(value);
}

function sortVisits(visits: Visit[]): Visit[] {
  return [...visits].sort((left, right) =>
    left.scheduledStart.localeCompare(
      right.scheduledStart,
    ),
  );
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function calendarDays(month: Date): Date[] {
  const first = monthStart(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export function VisitControl({
  job,
  refreshKey,
}: VisitControlProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadStatus, setLoadStatus] =
    useState<LoadStatus>("loading");
  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()));
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [updatingVisitId, setUpdatingVisitId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);
  const [messageTone, setMessageTone] =
    useState<MessageTone>("success");

  const isActive =
    job.lifecycleStatus === "active" &&
    job.archivedAt === null &&
    job.currentCycle.stage === "open";

  useEffect(() => {
    const controller = new AbortController();

    setLoadStatus("loading");
    setLoadError(null);

    void fetchVisits(job.id, controller.signal)
      .then((loadedVisits) => {
        setVisits(sortVisits(loadedVisits));
        setLoadStatus("ready");
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        setLoadStatus("error");
        setLoadError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load Visits.",
        );
      });

    return () => {
      controller.abort();
    };
  }, [job.id, refreshKey]);

  function resetForm(): void {
    setIsOpen(false);
    setVisitDate("");
    setStartTime("");
    setEndTime("");
    setCalendarMonth(monthStart(new Date()));
    setNotes("");
    setIsSaving(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      !isActive ||
      isSaving ||
      visitDate.length === 0 ||
      startTime.length === 0
    ) {
      return;
    }

    const startDate = new Date(`${visitDate}T${startTime}`);

    if (Number.isNaN(startDate.getTime())) {
      setMessageTone("error");
      setMessage("Visit start is invalid.");
      return;
    }

    let endIso: string | null = null;

    if (endTime.length > 0) {
      const endDate = new Date(`${visitDate}T${endTime}`);

      if (
        Number.isNaN(endDate.getTime()) ||
        endDate <= startDate
      ) {
        setMessageTone("error");
        setMessage(
          "Visit end must be after its start.",
        );
        return;
      }

      endIso = endDate.toISOString();
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const visit = await createVisit(job.id, {
        scheduledStart: startDate.toISOString(),
        scheduledEnd: endIso,
        notes,
      });

      setVisits((current) =>
        sortVisits([...current, visit]),
      );
      resetForm();
      setMessageTone("success");
      setMessage(
        `Visit scheduled for ${formatVisitTime(
          visit.scheduledStart,
        )}.`,
      );
    } catch (caughtError: unknown) {
      setIsSaving(false);
      setMessageTone("error");
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to schedule the Visit.",
      );
    }
  }

  async function handleStatusChange(
    visit: Visit,
    status: "completed" | "cancelled",
  ): Promise<void> {
    if (
      !isActive ||
      visit.jobCycleId !== job.currentCycle.id ||
      visit.status !== "scheduled" ||
      updatingVisitId !== null
    ) {
      return;
    }

    const action =
      status === "completed"
        ? "mark this Visit completed"
        : "cancel this Visit";

    if (!window.confirm(`Confirm: ${action}?`)) {
      return;
    }

    setUpdatingVisitId(visit.id);
    setMessage(null);

    try {
      const updatedVisit = await updateVisitStatus(
        job.id,
        visit.id,
        { status },
      );

      setVisits((current) =>
        current.map((candidate) =>
          candidate.id === updatedVisit.id
            ? updatedVisit
            : candidate,
        ),
      );
      setMessageTone("success");
      setMessage(
        status === "completed"
          ? "Visit marked completed."
          : "Visit cancelled.",
      );
    } catch (caughtError: unknown) {
      setMessageTone("error");
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update the Visit.",
      );
    } finally {
      setUpdatingVisitId(null);
    }
  }

  return (
    <section
      className="visit-control"
      aria-label="Job Visits"
    >
      <div className="visit-toolbar">
        {loadStatus === "ready" ? (
          <p className="visit-list-meta">
            <strong>{visits.length}</strong>
            <span>{visits.length === 1 ? "visit" : "visits"}</span>
          </p>
        ) : (
          <span />
        )}

        {isActive && (
          <button
            aria-expanded={isOpen}
            className="btn"
            disabled={isSaving}
            type="button"
            onClick={() => {
              setIsOpen((current) => !current);
              setMessage(null);
            }}
          >
            {isOpen ? "Close Scheduler" : "Schedule Visit"}
          </button>
        )}
      </div>

      {isActive && isOpen && (
        <section className="field-note-panel">
          <form
            className="field-note-form"
            onSubmit={handleSubmit}
          >
            <div className="visit-scheduler">
              <section className="visit-calendar" aria-label="Choose visit date">
                <header className="visit-calendar-heading">
                  <button
                    aria-label="Previous month"
                    disabled={isSaving}
                    type="button"
                    onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}
                  >
                    ←
                  </button>
                  <strong>
                    {new Intl.DateTimeFormat(undefined, {
                      month: "long",
                      year: "numeric",
                    }).format(calendarMonth)}
                  </strong>
                  <button
                    aria-label="Next month"
                    disabled={isSaving}
                    type="button"
                    onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}
                  >
                    →
                  </button>
                </header>

                <div className="visit-calendar-weekdays" aria-hidden="true">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="visit-calendar-days">
                  {calendarDays(calendarMonth).map((day) => {
                    const key = dateKey(day);
                    const isOutside = day.getMonth() !== calendarMonth.getMonth();
                    const isSelected = key === visitDate;
                    const isToday = key === dateKey(new Date());

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`${isOutside ? "is-outside " : ""}${isSelected ? "is-selected " : ""}${isToday ? "is-today" : ""}`.trim()}
                        disabled={isSaving}
                        key={key}
                        type="button"
                        onClick={() => {
                          setVisitDate(key);
                          if (isOutside) setCalendarMonth(monthStart(day));
                        }}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="visit-time-fields">
                <div className="visit-date-readout">
                  <span>Date</span>
                  <strong>
                    {visitDate
                      ? new Intl.DateTimeFormat(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(`${visitDate}T12:00`))
                      : "Choose a day"}
                  </strong>
                </div>

                <label className="field-note-field" htmlFor="visit-start-time">
                  <span>Start time</span>
                  <input
                    className="input"
                    disabled={isSaving}
                    id="visit-start-time"
                    required
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </label>

                <label className="field-note-field" htmlFor="visit-end-time">
                  <span>End time — Optional</span>
                  <input
                    className="input"
                    disabled={isSaving}
                    id="visit-end-time"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <label
              className="field-note-field"
              htmlFor="visit-notes"
            >
              <span>Notes — Optional</span>
              <textarea
                className="textarea"
                disabled={isSaving}
                id="visit-notes"
                placeholder="Purpose, access details, or preparation."
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
              />
            </label>

            <div className="field-note-actions">
              <button
                className="btn"
                disabled={isSaving}
                type="button"
                onClick={resetForm}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                disabled={
                  isSaving ||
                  visitDate.length === 0 ||
                  startTime.length === 0
                }
                type="submit"
              >
                {isSaving
                  ? "Scheduling…"
                  : "Schedule Visit"}
              </button>
            </div>
          </form>
        </section>
      )}

      {message && (
        <div
          className={
            messageTone === "error"
              ? "notice notice-error"
              : "notice notice-success"
          }
          role={
            messageTone === "error"
              ? "alert"
              : "status"
          }
        >
          <strong>{message}</strong>
        </div>
      )}

      <section className="visit-list-panel">
        {loadStatus === "loading" && (
          <div className="notice">
            Loading Visits…
          </div>
        )}

        {loadStatus === "error" && (
          <div
            className="notice notice-error"
            role="alert"
          >
            <strong>
              {loadError ?? "Unable to load Visits."}
            </strong>
          </div>
        )}

        {loadStatus === "ready" &&
          visits.length === 0 && (
            <p className="visit-empty">
              No Visits scheduled for this Job.
            </p>
          )}

        {loadStatus === "ready" &&
          visits.length > 0 && (
            <div className="visit-list">
              {visits.map((visit) => {
                const isUpdating =
                  updatingVisitId === visit.id;

                return (
                  <article
                    className="visit-card"
                    key={visit.id}
                  >
                    <header className="visit-card-header">
                      <div className="visit-card-when">
                        <strong>{formatVisitDate(visit.scheduledStart)}</strong>
                        <span className="visit-card-time">
                          {formatVisitClock(visit.scheduledStart)}
                          {visit.scheduledEnd
                            ? `–${formatVisitClock(visit.scheduledEnd)}`
                            : ""}
                        </span>
                        <span className="visit-cycle">
                          Cycle {visit.cycleNumber}
                          {visit.cycleNumber === job.currentCycle.cycleNumber
                            ? " · Current"
                            : ""}
                        </span>
                      </div>

                      <div className="visit-card-controls">
                        <span className="visit-status">
                          {visit.status}
                        </span>

                        {isActive &&
                          visit.jobCycleId === job.currentCycle.id &&
                          visit.status === "scheduled" && (
                            <div className="visit-card-actions">
                              <button
                                className="btn btn-primary"
                                disabled={isUpdating}
                                type="button"
                                onClick={() =>
                                  void handleStatusChange(visit, "completed")
                                }
                              >
                                Complete
                              </button>
                              <button
                                className="btn"
                                disabled={isUpdating}
                                type="button"
                                onClick={() =>
                                  void handleStatusChange(visit, "cancelled")
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                      </div>
                    </header>

                    {visit.notes && (
                      <div className="visit-detail-block">
                        <span className="visit-detail-label">
                          Visit Notes
                        </span>
                        <p>{visit.notes}</p>
                      </div>
                    )}

                    {visit.linkedScopeRevisions.length > 0 && (
                      <section className="visit-scope-panel">
                        <header className="visit-scope-heading">
                          <span className="visit-detail-label">
                            Related Scope Changes
                          </span>
                          <strong>
                            {visit.linkedScopeRevisions.length}
                          </strong>
                        </header>

                        <div className="visit-scope-list">
                          {visit.linkedScopeRevisions.map(
                            (revision) => (
                              <article
                                className="visit-scope-record"
                                key={revision.id}
                              >
                                <div className="visit-scope-record-heading">
                                  <strong>
                                    Revision{" "}
                                    {revision.revisionNumber}
                                  </strong>

                                  <span>
                                    {formatPriceChange(
                                      revision.priceChange,
                                    )}
                                  </span>
                                </div>

                                <p>{revision.scopeText}</p>

                                {revision.reason && (
                                  <p className="visit-scope-reason">
                                    {revision.reason}
                                  </p>
                                )}

                                <span className="visit-relationship">
                                  {revision.relationshipType ===
                                  "planned_for"
                                    ? "Planned for this Visit"
                                    : "Discovered during this Visit"}
                                </span>
                              </article>
                            ),
                          )}
                        </div>
                      </section>
                    )}

                  </article>
                );
              })}
            </div>
          )}
      </section>
    </section>
  );
}
