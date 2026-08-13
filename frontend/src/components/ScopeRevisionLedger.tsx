import type {
  Job,
  ScopeRevision,
  UpdateScopeRevisionVisitPlanInput,
  Visit,
} from "@vizow/shared";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  fetchScopeRevisions,
  fetchVisits,
  updateScopeRevisionVisitPlan,
} from "../api/jobs";

type ScopeRevisionLedgerProps = {
  job: Job;
  refreshKey: number;
  onChanged: () => void;
};

type DecisionChoice =
  | "not_required"
  | "existing"
  | "new";

type LoadStatus =
  | "loading"
  | "ready"
  | "error";

function formatVisitTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPriceChange(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    signDisplay: "always",
  }).format(value);
}

function getRequirementLabel(
  requirement: ScopeRevision["visitRequirement"],
): string {
  if (requirement === "undecided") {
    return "Visit Decision Needed";
  }

  if (requirement === "not_required") {
    return "No Visit Needed";
  }

  return "Visit Required";
}

export function ScopeRevisionLedger({
  job,
  refreshKey,
  onChanged,
}: ScopeRevisionLedgerProps) {
  const [revisions, setRevisions] = useState<
    ScopeRevision[]
  >([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadStatus, setLoadStatus] =
    useState<LoadStatus>("loading");
  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [editingRevisionId, setEditingRevisionId] =
    useState<string | null>(null);
  const [decisionChoice, setDecisionChoice] =
    useState<DecisionChoice>("not_required");
  const [existingVisitId, setExistingVisitId] =
    useState("");
  const [scheduledStart, setScheduledStart] =
    useState("");
  const [scheduledEnd, setScheduledEnd] =
    useState("");
  const [visitNotes, setVisitNotes] = useState("");

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] =
    useState<string | null>(null);

  const isActive =
    job.lifecycleStatus === "active" &&
    job.archivedAt === null &&
    job.currentCycle.stage === "open";

  const currentRevisions = useMemo(
    () =>
      revisions
        .filter(
          (revision) =>
            revision.jobCycleId === job.currentCycle.id,
        )
        .sort(
          (left, right) =>
            left.revisionNumber - right.revisionNumber,
        ),
    [job.currentCycle.id, revisions],
  );

  const scheduledVisits = useMemo(
    () =>
      visits.filter(
        (visit) =>
          visit.jobCycleId === job.currentCycle.id &&
          visit.status === "scheduled",
      ),
    [job.currentCycle.id, visits],
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoadStatus("loading");
    setLoadError(null);

    void Promise.all([
      fetchScopeRevisions(job.id, controller.signal),
      fetchVisits(job.id, controller.signal),
    ])
      .then(([loadedRevisions, loadedVisits]) => {
        setRevisions(loadedRevisions);
        setVisits(loadedVisits);
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
            : "Unable to load Scope Revisions.",
        );
      });

    return () => {
      controller.abort();
    };
  }, [
    job.currentCycle.id,
    job.id,
    refreshKey,
  ]);

  function resetEditor(): void {
    setEditingRevisionId(null);
    setDecisionChoice("not_required");
    setExistingVisitId("");
    setScheduledStart("");
    setScheduledEnd("");
    setVisitNotes("");
  }

  function beginEditing(revisionId: string): void {
    if (!isActive) {
      return;
    }

    setEditingRevisionId(revisionId);
    setDecisionChoice("not_required");
    setExistingVisitId(
      scheduledVisits[0]?.id ?? "",
    );
    setScheduledStart("");
    setScheduledEnd("");
    setVisitNotes("");
    setSaveStatus("idle");
    setSaveMessage(null);
  }

  function buildUpdateInput():
    | UpdateScopeRevisionVisitPlanInput
    | null {
    if (decisionChoice === "not_required") {
      return {
        visitPlan: {
          mode: "not_required",
        },
      };
    }

    if (decisionChoice === "existing") {
      if (!existingVisitId) {
        setSaveStatus("error");
        setSaveMessage(
          "Select a scheduled Visit before saving.",
        );
        return null;
      }

      return {
        visitPlan: {
          mode: "existing",
          visitId: existingVisitId,
          relationshipType: "planned_for",
        },
      };
    }

    if (!scheduledStart) {
      setSaveStatus("error");
      setSaveMessage(
        "A start date and time are required.",
      );
      return null;
    }

    const startDate = new Date(scheduledStart);

    if (Number.isNaN(startDate.getTime())) {
      setSaveStatus("error");
      setSaveMessage("The Visit start is invalid.");
      return null;
    }

    let endIso: string | null = null;

    if (scheduledEnd) {
      const endDate = new Date(scheduledEnd);

      if (
        Number.isNaN(endDate.getTime()) ||
        endDate <= startDate
      ) {
        setSaveStatus("error");
        setSaveMessage(
          "The Visit end must be after its start.",
        );
        return null;
      }

      endIso = endDate.toISOString();
    }

    return {
      visitPlan: {
        mode: "new",
        visit: {
          scheduledStart: startDate.toISOString(),
          scheduledEnd: endIso,
          notes: visitNotes,
        },
      },
    };
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      !isActive ||
      !editingRevisionId ||
      saveStatus === "saving"
    ) {
      return;
    }

    const input = buildUpdateInput();

    if (!input) {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage(null);

    try {
      const result =
        await updateScopeRevisionVisitPlan(
          job.id,
          editingRevisionId,
          input,
        );

      setRevisions((current) =>
        current.map((revision) =>
          revision.id === result.scopeRevision.id
            ? result.scopeRevision
            : revision,
        ),
      );

      setSaveStatus("saved");
      setSaveMessage(
        `Scope Revision ${result.scopeRevision.revisionNumber} Visit decision saved.`,
      );

      resetEditor();
      onChanged();
    } catch (caughtError: unknown) {
      setSaveStatus("error");
      setSaveMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update the Scope Revision.",
      );
    }
  }

  if (loadStatus === "loading") {
    return (
      <div className="notice">
        Loading Scope Revisions…
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div
        className="notice notice-error"
        role="alert"
      >
        <strong>
          {loadError ??
            "Unable to load Scope Revisions."}
        </strong>
      </div>
    );
  }

  if (currentRevisions.length === 0) {
    return (
      <p className="scope-revision-empty">
        No scope changes in Cycle {job.currentCycle.cycleNumber}.
      </p>
    );
  }

  return (
    <section
      aria-labelledby="scope-revision-ledger-title"
      className="scope-revision-ledger"
    >
      <header className="scope-revision-ledger-header">
        <div>
          <span className="visit-cycle-label">
            Cycle {job.currentCycle.cycleNumber}
          </span>

          <h3 id="scope-revision-ledger-title">
            Scope Revisions
          </h3>
        </div>

        <strong>{currentRevisions.length}</strong>
      </header>

      <div className="visit-list">
        {currentRevisions.map((revision) => {
          const isEditing =
            editingRevisionId === revision.id;

          return (
            <article
              className="visit-card scope-revision-card"
              key={revision.id}
            >
              <header className="visit-card-header">
                <strong>
                  Revision {revision.revisionNumber}
                </strong>

                <strong>
                  {formatPriceChange(
                    revision.priceChange,
                  )}
                </strong>
              </header>

              <p>{revision.scopeText}</p>

              {revision.reason && (
                <p className="visit-scope-reason">
                  {revision.reason}
                </p>
              )}

              <div className="scope-revision-meta">
                <span className="visit-scope-badge">
                  {getRequirementLabel(
                    revision.visitRequirement,
                  )}
                </span>

                {revision.linkedVisitIds.length > 0 && (
                  <span>
                    {revision.linkedVisitIds.length} linked{" "}
                    {revision.linkedVisitIds.length === 1
                      ? "Visit"
                      : "Visits"}
                  </span>
                )}
              </div>

              {revision.visitRequirement ===
                "undecided" &&
                isActive &&
                !isEditing && (
                  <div className="field-note-actions">
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        beginEditing(revision.id)
                      }
                    >
                      Resolve Visit Decision
                    </button>
                  </div>
                )}

              {isActive && isEditing && (
                <form
                  className="field-note-form scope-decision-form"
                  onSubmit={handleSubmit}
                >
                  <label
                    className="field-note-field"
                    htmlFor={`scope-decision-${revision.id}`}
                  >
                    <span>Visit Needed?</span>

                    <select
                      className="input"
                      disabled={
                        saveStatus === "saving"
                      }
                      id={`scope-decision-${revision.id}`}
                      value={decisionChoice}
                      onChange={(event) => {
                        setDecisionChoice(
                          event.target
                            .value as DecisionChoice,
                        );
                        setSaveStatus("idle");
                        setSaveMessage(null);
                      }}
                    >
                      <option value="not_required">
                        No Visit Needed
                      </option>

                      <option value="existing">
                        Use Scheduled Visit
                      </option>

                      <option value="new">
                        Schedule New Visit
                      </option>
                    </select>
                  </label>

                  {decisionChoice === "existing" && (
                    <>
                      {scheduledVisits.length === 0 ? (
                        <div className="notice">
                          No scheduled Visits are
                          available.
                        </div>
                      ) : (
                        <label
                          className="field-note-field"
                          htmlFor={`scope-existing-${revision.id}`}
                        >
                          <span>Scheduled Visit</span>

                          <select
                            className="input"
                            disabled={
                              saveStatus === "saving"
                            }
                            id={`scope-existing-${revision.id}`}
                            value={existingVisitId}
                            onChange={(event) =>
                              setExistingVisitId(
                                event.target.value,
                              )
                            }
                          >
                            {scheduledVisits.map(
                              (visit) => (
                                <option
                                  key={visit.id}
                                  value={visit.id}
                                >
                                  {formatVisitTime(
                                    visit.scheduledStart,
                                  )}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      )}
                    </>
                  )}

                  {decisionChoice === "new" && (
                    <>
                      <div className="visit-form-grid">
                        <label
                          className="field-note-field"
                          htmlFor={`scope-start-${revision.id}`}
                        >
                          <span>Visit Start</span>

                          <input
                            className="input"
                            disabled={
                              saveStatus === "saving"
                            }
                            id={`scope-start-${revision.id}`}
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
                          htmlFor={`scope-end-${revision.id}`}
                        >
                          <span>
                            Visit End — Optional
                          </span>

                          <input
                            className="input"
                            disabled={
                              saveStatus === "saving"
                            }
                            id={`scope-end-${revision.id}`}
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
                        htmlFor={`scope-notes-${revision.id}`}
                      >
                        <span>
                          Visit Notes — Optional
                        </span>

                        <textarea
                          className="textarea"
                          disabled={
                            saveStatus === "saving"
                          }
                          id={`scope-notes-${revision.id}`}
                          value={visitNotes}
                          onChange={(event) =>
                            setVisitNotes(
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </>
                  )}

                  <div className="field-note-actions">
                    <button
                      className="btn"
                      disabled={
                        saveStatus === "saving"
                      }
                      type="button"
                      onClick={() => {
                        resetEditor();
                        setSaveStatus("idle");
                        setSaveMessage(null);
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      className="btn btn-primary"
                      disabled={
                        saveStatus === "saving" ||
                        (decisionChoice ===
                          "existing" &&
                          !existingVisitId) ||
                        (decisionChoice === "new" &&
                          !scheduledStart)
                      }
                      type="submit"
                    >
                      {saveStatus === "saving"
                        ? "Saving…"
                        : "Save Visit Decision"}
                    </button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </div>

      {saveMessage && (
        <div
          className={
            saveStatus === "error"
              ? "notice notice-error"
              : "notice notice-success"
          }
          role={
            saveStatus === "error"
              ? "alert"
              : "status"
          }
        >
          <strong>{saveMessage}</strong>
        </div>
      )}
    </section>
  );
}
