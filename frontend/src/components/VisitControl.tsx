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
};

type LoadStatus = "loading" | "ready" | "error";
type MessageTone = "success" | "error";

function formatVisitTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sortVisits(visits: Visit[]): Visit[] {
  return [...visits].sort((left, right) =>
    left.scheduledStart.localeCompare(
      right.scheduledStart,
    ),
  );
}

export function VisitControl({
  job,
}: VisitControlProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadStatus, setLoadStatus] =
    useState<LoadStatus>("loading");
  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [scheduledStart, setScheduledStart] =
    useState("");
  const [scheduledEnd, setScheduledEnd] =
    useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [updatingVisitId, setUpdatingVisitId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);
  const [messageTone, setMessageTone] =
    useState<MessageTone>("success");

  const isActive =
    job.currentCycle.stage === "project";

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
  }, [job.id]);

  function resetForm(): void {
    setIsOpen(false);
    setScheduledStart("");
    setScheduledEnd("");
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
      scheduledStart.length === 0
    ) {
      return;
    }

    const startDate = new Date(scheduledStart);

    if (Number.isNaN(startDate.getTime())) {
      setMessageTone("error");
      setMessage("Visit start is invalid.");
      return;
    }

    let endIso: string | null = null;

    if (scheduledEnd.length > 0) {
      const endDate = new Date(scheduledEnd);

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
      <div className="field-note-actions">
        <button
          aria-expanded={isOpen}
          className="btn"
          disabled={!isActive || isSaving}
          type="button"
          onClick={() => {
            setIsOpen(true);
            setMessage(null);
          }}
        >
          {isActive
            ? "Schedule Visit"
            : "Visits Locked"}
        </button>
      </div>

      {isOpen && (
        <section className="field-note-panel">
          <form
            className="field-note-form"
            onSubmit={handleSubmit}
          >
            <div className="visit-form-grid">
              <label
                className="field-note-field"
                htmlFor="visit-start"
              >
                <span>Start</span>
                <input
                  className="input"
                  disabled={isSaving}
                  id="visit-start"
                  required
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(event) =>
                    setScheduledStart(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label
                className="field-note-field"
                htmlFor="visit-end"
              >
                <span>End — Optional</span>
                <input
                  className="input"
                  disabled={isSaving}
                  id="visit-end"
                  type="datetime-local"
                  value={scheduledEnd}
                  onChange={(event) =>
                    setScheduledEnd(event.target.value)
                  }
                />
              </label>
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
                  scheduledStart.length === 0
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
        <header className="visit-list-heading">
          <div>
            <p className="eyebrow">Visits</p>
            <h2>Job Visits</h2>
          </div>

          {loadStatus === "ready" && (
            <strong>{visits.length}</strong>
          )}
        </header>

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
                    <div>
                      <strong>
                        {formatVisitTime(
                          visit.scheduledStart,
                        )}
                      </strong>

                      <span>
                        {visit.scheduledEnd
                          ? ` to ${formatVisitTime(
                              visit.scheduledEnd,
                            )}`
                          : ""}
                      </span>
                    </div>

                    <span className="visit-status">
                      {visit.status}
                    </span>

                    {visit.notes && (
                      <p>{visit.notes}</p>
                    )}

                    {visit.status === "scheduled" && (
                      <div className="visit-card-actions">
                        <button
                          className="btn btn-primary"
                          disabled={isUpdating}
                          type="button"
                          onClick={() =>
                            void handleStatusChange(
                              visit,
                              "completed",
                            )
                          }
                        >
                          Complete
                        </button>

                        <button
                          className="btn"
                          disabled={isUpdating}
                          type="button"
                          onClick={() =>
                            void handleStatusChange(
                              visit,
                              "cancelled",
                            )
                          }
                        >
                          Cancel Visit
                        </button>
                      </div>
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
