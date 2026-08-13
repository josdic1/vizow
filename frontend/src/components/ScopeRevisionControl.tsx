import type {
  Job,
  ScopeVisitPlan,
  Visit,
} from "@vizow/shared";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  createScopeRevision,
  fetchVisits,
} from "../api/jobs";

type ScopeRevisionControlProps = {
  job: Job;
  onVisitsChanged: () => void;
};

type VisitChoice =
  | "undecided"
  | "not_required"
  | "existing"
  | "new";

type VisitLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

function formatVisitTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ScopeRevisionControl({
  job,
  onVisitsChanged,
}: ScopeRevisionControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scopeText, setScopeText] = useState("");
  const [priceChange, setPriceChange] = useState("0");
  const [reason, setReason] = useState("");

  const [visitChoice, setVisitChoice] =
    useState<VisitChoice>("undecided");
  const [existingVisitId, setExistingVisitId] =
    useState("");
  const [scheduledStart, setScheduledStart] =
    useState("");
  const [scheduledEnd, setScheduledEnd] =
    useState("");
  const [visitNotes, setVisitNotes] = useState("");

  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitLoadStatus, setVisitLoadStatus] =
    useState<VisitLoadStatus>("idle");
  const [visitLoadError, setVisitLoadError] =
    useState<string | null>(null);

  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] =
    useState<string | null>(null);

  const isActive =
    job.lifecycleStatus === "active" &&
    job.archivedAt === null &&
    job.currentCycle.stage === "open";
  const isSaving = status === "saving";

  const eligibleVisits = useMemo(
    () =>
      visits.filter(
        (visit) =>
          visit.jobCycleId === job.currentCycle.id &&
          visit.status !== "cancelled",
      ),
    [job.currentCycle.id, visits],
  );

  useEffect(() => {
    if (
      !isActive ||
      !isOpen ||
      visitChoice !== "existing"
    ) {
      return;
    }

    const controller = new AbortController();

    setVisitLoadStatus("loading");
    setVisitLoadError(null);

    void fetchVisits(job.id, controller.signal)
      .then((loadedVisits) => {
        const availableVisits = loadedVisits.filter(
          (visit) =>
            visit.jobCycleId === job.currentCycle.id &&
            visit.status !== "cancelled",
        );

        setVisits(loadedVisits);
        setExistingVisitId((current) => {
          if (
            current &&
            availableVisits.some(
              (visit) => visit.id === current,
            )
          ) {
            return current;
          }

          return availableVisits[0]?.id ?? "";
        });
        setVisitLoadStatus("ready");
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        setVisitLoadStatus("error");
        setVisitLoadError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load Visits.",
        );
      });

    return () => {
      controller.abort();
    };
  }, [
    isOpen,
    isActive,
    job.currentCycle.id,
    job.id,
    visitChoice,
  ]);

  function resetForm(): void {
    setIsOpen(false);
    setScopeText("");
    setPriceChange("0");
    setReason("");
    setVisitChoice("undecided");
    setExistingVisitId("");
    setScheduledStart("");
    setScheduledEnd("");
    setVisitNotes("");
    setVisits([]);
    setVisitLoadStatus("idle");
    setVisitLoadError(null);
  }

  function closeForm(): void {
    resetForm();
    setStatus("idle");
    setMessage(null);
  }

  function buildVisitPlan():
    | ScopeVisitPlan
    | null {
    if (visitChoice === "undecided") {
      return {
        mode: "undecided",
      };
    }

    if (visitChoice === "not_required") {
      return {
        mode: "not_required",
      };
    }

    if (visitChoice === "existing") {
      const selectedVisit = eligibleVisits.find(
        (visit) => visit.id === existingVisitId,
      );

      if (!selectedVisit) {
        setStatus("error");
        setMessage(
          "Select an existing Visit before saving.",
        );
        return null;
      }

      return {
        mode: "existing",
        visitId: selectedVisit.id,
        relationshipType:
          selectedVisit.status === "completed"
            ? "discovered_during"
            : "planned_for",
      };
    }

    if (!scheduledStart) {
      setStatus("error");
      setMessage(
        "A start date and time are required for the new Visit.",
      );
      return null;
    }

    const startDate = new Date(scheduledStart);

    if (Number.isNaN(startDate.getTime())) {
      setStatus("error");
      setMessage("The Visit start is invalid.");
      return null;
    }

    let endIso: string | null = null;

    if (scheduledEnd) {
      const endDate = new Date(scheduledEnd);

      if (
        Number.isNaN(endDate.getTime()) ||
        endDate <= startDate
      ) {
        setStatus("error");
        setMessage(
          "The Visit end must be after its start.",
        );
        return null;
      }

      endIso = endDate.toISOString();
    }

    return {
      mode: "new",
      visit: {
        scheduledStart: startDate.toISOString(),
        scheduledEnd: endIso,
        notes: visitNotes,
      },
    };
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      !isActive ||
      isSaving ||
      scopeText.trim().length === 0
    ) {
      return;
    }

    const parsedPriceChange =
      priceChange.trim().length === 0
        ? 0
        : Number(priceChange);

    if (!Number.isFinite(parsedPriceChange)) {
      setStatus("error");
      setMessage(
        "Price change must be a valid number.",
      );
      return;
    }

    const visitPlan = buildVisitPlan();

    if (!visitPlan) {
      return;
    }

    setStatus("saving");
    setMessage(null);

    try {
      const result = await createScopeRevision(
        job.id,
        {
          scopeText,
          priceChange: parsedPriceChange,
          reason,
          visitPlan,
        },
      );

      onVisitsChanged();

      const savedRevision =
        result.scopeRevision.revisionNumber;

      resetForm();
      setStatus("saved");

      if (visitPlan.mode === "new" && result.visit) {
        setMessage(
          `Scope Revision ${savedRevision} saved. Visit scheduled for ${formatVisitTime(
            result.visit.scheduledStart,
          )}.`,
        );
      } else if (
        visitPlan.mode === "existing" &&
        result.visit
      ) {
        setMessage(
          `Scope Revision ${savedRevision} saved and linked to the selected Visit.`,
        );
      } else if (
        visitPlan.mode === "not_required"
      ) {
        setMessage(
          `Scope Revision ${savedRevision} saved. No Visit required.`,
        );
      } else {
        setMessage(
          `Scope Revision ${savedRevision} saved. Visit decision remains open.`,
        );
      }
    } catch (caughtError: unknown) {
      setStatus("error");
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the scope revision.",
      );
    }
  }

  return (
    <>
      {isActive && (
        <div className="scope-revision-toolbar">
          <span>Changes to the approved work</span>
          <button
            aria-expanded={isOpen}
            className="btn"
            disabled={isSaving}
            type="button"
            onClick={() => {
              if (isOpen) {
                closeForm();
              } else {
                setIsOpen(true);
                setStatus("idle");
                setMessage(null);
              }
            }}
          >
            {isOpen ? "Close" : "Add Scope Change"}
          </button>
        </div>
      )}

      {isActive && isOpen && (
        <section className="field-note-panel">
          <form
            className="field-note-form"
            onSubmit={handleSubmit}
          >
            <label
              className="field-note-field"
              htmlFor="scope-revision-text"
            >
              <span>Revised Scope</span>

              <textarea
                autoFocus
                className="textarea"
                disabled={isSaving}
                id="scope-revision-text"
                placeholder="What work changed?"
                required
                value={scopeText}
                onChange={(event) =>
                  setScopeText(event.target.value)
                }
              />
            </label>

            <label
              className="field-note-field"
              htmlFor="scope-price-change"
            >
              <span>Price Change</span>

              <input
                className="input"
                disabled={isSaving}
                id="scope-price-change"
                inputMode="decimal"
                step="0.01"
                type="number"
                value={priceChange}
                onChange={(event) =>
                  setPriceChange(event.target.value)
                }
              />
            </label>

            <label
              className="field-note-field"
              htmlFor="scope-reason"
            >
              <span>Reason — Optional</span>

              <input
                className="input"
                disabled={isSaving}
                id="scope-reason"
                placeholder="Why did the work change?"
                type="text"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
              />
            </label>

            <label
              className="field-note-field"
              htmlFor="scope-visit-choice"
            >
              <span>Visit Needed?</span>

              <select
                className="input"
                disabled={isSaving}
                id="scope-visit-choice"
                value={visitChoice}
                onChange={(event) => {
                  setVisitChoice(
                    event.target.value as VisitChoice,
                  );
                  setMessage(null);
                  setStatus("idle");
                }}
              >
                <option value="undecided">
                  Decide Later
                </option>
                <option value="not_required">
                  No Visit Needed
                </option>
                <option value="existing">
                  Use Existing Visit
                </option>
                <option value="new">
                  Schedule New Visit
                </option>
              </select>
            </label>

            {visitChoice === "existing" && (
              <>
                {visitLoadStatus === "loading" && (
                  <div className="notice">
                    Loading available Visits…
                  </div>
                )}

                {visitLoadStatus === "error" && (
                  <div
                    className="notice notice-error"
                    role="alert"
                  >
                    <strong>
                      {visitLoadError ??
                        "Unable to load Visits."}
                    </strong>
                  </div>
                )}

                {visitLoadStatus === "ready" &&
                  eligibleVisits.length === 0 && (
                    <div className="notice">
                      No non-cancelled Visits exist in
                      this work cycle.
                    </div>
                  )}

                {visitLoadStatus === "ready" &&
                  eligibleVisits.length > 0 && (
                    <label
                      className="field-note-field"
                      htmlFor="scope-existing-visit"
                    >
                      <span>Existing Visit</span>

                      <select
                        className="input"
                        disabled={isSaving}
                        id="scope-existing-visit"
                        required
                        value={existingVisitId}
                        onChange={(event) =>
                          setExistingVisitId(
                            event.target.value,
                          )
                        }
                      >
                        {eligibleVisits.map((visit) => (
                          <option
                            key={visit.id}
                            value={visit.id}
                          >
                            {formatVisitTime(
                              visit.scheduledStart,
                            )}{" "}
                            —{" "}
                            {visit.status === "completed"
                              ? "Completed · Discovered during"
                              : "Scheduled · Planned work"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
              </>
            )}

            {visitChoice === "new" && (
              <>
                <div className="visit-form-grid">
                  <label
                    className="field-note-field"
                    htmlFor="scope-new-visit-start"
                  >
                    <span>Visit Start</span>

                    <input
                      className="input"
                      disabled={isSaving}
                      id="scope-new-visit-start"
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
                    htmlFor="scope-new-visit-end"
                  >
                    <span>Visit End — Optional</span>

                    <input
                      className="input"
                      disabled={isSaving}
                      id="scope-new-visit-end"
                      type="datetime-local"
                      value={scheduledEnd}
                      onChange={(event) =>
                        setScheduledEnd(
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>

                <label
                  className="field-note-field"
                  htmlFor="scope-new-visit-notes"
                >
                  <span>Visit Notes — Optional</span>

                  <textarea
                    className="textarea"
                    disabled={isSaving}
                    id="scope-new-visit-notes"
                    placeholder="Purpose, access details, or preparation."
                    value={visitNotes}
                    onChange={(event) =>
                      setVisitNotes(event.target.value)
                    }
                  />
                </label>
              </>
            )}

            <div className="field-note-actions">
              <button
                className="btn"
                disabled={isSaving}
                type="button"
                onClick={closeForm}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                disabled={
                  isSaving ||
                  scopeText.trim().length === 0 ||
                  (visitChoice === "existing" &&
                    !existingVisitId) ||
                  (visitChoice === "new" &&
                    !scheduledStart)
                }
                type="submit"
              >
                {isSaving
                  ? "Saving…"
                  : "Save Scope Revision"}
              </button>
            </div>
          </form>
        </section>
      )}

      {message && (
        <div
          className={
            status === "error"
              ? "notice notice-error"
              : "notice notice-success"
          }
          role={
            status === "error"
              ? "alert"
              : "status"
          }
        >
          <strong>{message}</strong>
        </div>
      )}
    </>
  );
}
