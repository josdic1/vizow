import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Job, JobJourneyEvent } from "@vizow/shared";

import {
  createFieldNote,
  fetchJob,
  fetchJobJourney,
  fetchJobJourneySummary,
  summarizeJobJourney,
} from "../api/jobs";
import { JourneyLine } from "../components/JourneyLine";
import { JobWorkspace } from "../components/JobWorkspace";
import { useActiveJob } from "../contexts/ActiveJobContext";
import { AppLayout } from "../layouts/AppLayout";

type JobPageState =
  | { status: "loading" }
  | { status: "ready"; job: Job; events: JobJourneyEvent[] }
  | { status: "error"; message: string };

type SummaryState =
  | { status: "loading" }
  | { status: "ready"; summary: string }
  | { status: "error"; message: string };

function formatAddress(job: Job): string {
  return [
    [job.serviceAddressLine1, job.serviceAddressLine2]
      .filter(Boolean)
      .join(", "),
    [job.serviceCity, job.serviceState, job.servicePostalCode]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ") || "No service address recorded";
}

function jobStatus(job: Job): string {
  if (job.archivedAt) return "Archived";
  if (job.lifecycleStatus === "cancelled") return "Cancelled";
  return job.currentCycle.stage === "completed" ? "Completed" : "Active";
}

function currentPositionLabel(job: Job): string {
  if (job.archivedAt) return "Archived";
  if (job.lifecycleStatus === "cancelled") return "Cancelled";
  if (job.currentCycle.stage === "completed") return "Completed";
  if (job.currentCycle.reason === "reopened") return "Reopened · Active";
  return "Active";
}

function currentPositionHelp(job: Job): string {
  if (job.archivedAt) {
    return "This Job is archived. Its history, photos, notes, and VOW are preserved.";
  }
  if (job.lifecycleStatus === "cancelled") {
    return "This Job was cancelled. Its recorded history remains available.";
  }
  if (job.currentCycle.stage === "completed") {
    return "This cycle is closed. Reopen the Job only if more work is needed.";
  }
  if (job.currentCycle.reason === "reopened") {
    return "Work is open again after an earlier cycle was completed. New activity belongs to this cycle.";
  }
  return "Work is open. Notes, visits, scope changes, and photos belong to this cycle.";
}

export function JobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { selectActiveJob } = useActiveJob();
  const [state, setState] = useState<JobPageState>(
    jobId
      ? { status: "loading" }
      : { status: "error", message: "The Job ID is missing." },
  );
  const [summaryState, setSummaryState] = useState<SummaryState>({
    status: "loading",
  });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [quickNote, setQuickNote] = useState("");
  const [quickNoteStatus, setQuickNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [quickNoteMessage, setQuickNoteMessage] = useState<string | null>(null);
  const autoSummaryJobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const controller = new AbortController();

    Promise.all([
      fetchJob(jobId, controller.signal),
      fetchJobJourney(jobId, controller.signal),
    ])
      .then(([job, events]) => setState({ status: "ready", job, events }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Unable to load this Job.",
        });
      });

    return () => controller.abort();
  }, [jobId, refreshVersion]);

  useEffect(() => {
    if (state.status !== "ready") return;

    const job = state.job;
    const controller = new AbortController();

    fetchJobJourneySummary(job.id, controller.signal)
      .then(async (result) => {
        if (result.summary && !result.stale) {
          setSummaryState({
            status: "ready",
            summary: result.summary.summary,
          });
          return;
        }

        if (autoSummaryJobRef.current === job.id) return;
        autoSummaryJobRef.current = job.id;

        const generated = await summarizeJobJourney(job.id, controller.signal);
        setSummaryState({ status: "ready", summary: generated.summary });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSummaryState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the Job summary.",
        });
      });

    return () => controller.abort();
  }, [state]);


  const job = state.status === "ready" ? state.job : null;
  const canEnterFieldMode = Boolean(
    job &&
      job.lifecycleStatus === "active" &&
      !job.archivedAt &&
      job.currentCycle.stage === "open",
  );

  function enterFieldMode(): void {
    if (!job || !canEnterFieldMode) return;
    selectActiveJob(job.id);
    navigate("/app/field");
  }

  async function saveQuickNote(): Promise<void> {
    const content = quickNote.trim();
    if (!job || !canEnterFieldMode || !content || quickNoteStatus === "saving") return;

    setQuickNoteStatus("saving");
    setQuickNoteMessage(null);

    try {
      await createFieldNote(job.id, { content });
      setQuickNote("");
      setQuickNoteStatus("saved");
      setQuickNoteMessage("Saved to the Job Journey.");
      setRefreshVersion((current) => current + 1);
    } catch (error: unknown) {
      setQuickNoteStatus("error");
      setQuickNoteMessage(error instanceof Error ? error.message : "Unable to save note.");
    }
  }

  async function updateSummary(): Promise<void> {
    if (!job || summaryState.status === "loading") return;
    setSummaryState({ status: "loading" });

    try {
      const result = await summarizeJobJourney(job.id);
      setSummaryState({ status: "ready", summary: result.summary });
    } catch (error: unknown) {
      setSummaryState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update the Job summary.",
      });
    }
  }

  return (
    <AppLayout
      object={job?.title ?? "Job"}
      tool="Jobs"
      action="Review Job"
      result={
        state.status === "loading"
          ? "Loading"
          : state.status === "error"
            ? "Not loaded"
            : jobStatus(state.job)
      }
      message={
        job
          ? `${job.title} · Cycle ${job.currentCycle.cycleNumber}`
          : "Loading this Job."
      }
      activeStep={state.status === "loading" ? "result" : "action"}
      resultTone={
        state.status === "error"
          ? "error"
          : state.status === "loading"
            ? "working"
            : "success"
      }
      sections={[
        { id: "job-overview", label: "Overview" },
        { id: "job-notes", label: "Note" },
        { id: "job-journey", label: "Journey" },
        { id: "job-scope", label: "Scope" },
        { id: "job-visits", label: "Visits" },
        { id: "job-photos", label: "Photos" },
      ]}
    >
      <main className="job-page page">
        {state.status === "loading" && <div className="notice">Loading Job…</div>}

        {state.status === "error" && (
          <section className="job-page-error">
            <Link className="btn" to="/app/jobs">← Jobs</Link>
            <div className="notice notice-error">{state.message}</div>
          </section>
        )}

        {state.status === "ready" && (
          <div className="job-page-shell">
            <header className="job-page-command-bar">
              <div className="job-page-identity">
                <Link className="job-page-back" to="/app/jobs">← Jobs</Link>
                <div>
                  <h1>{state.job.title}</h1>
                  <p className="job-page-subline">
                    <strong>{state.job.clientName}</strong>
                    <span>{formatAddress(state.job)}</span>
                    <span>Cycle {state.job.currentCycle.cycleNumber}</span>
                    <b>{jobStatus(state.job)}</b>
                  </p>
                </div>
              </div>

              <nav className="job-page-actions" aria-label="Job records and tools">
                <Link
                  className="job-page-record-link"
                  to={`/app/clients/${state.job.clientId}`}
                >
                  <span>Client record</span>
                  <strong>{state.job.clientName}</strong>
                </Link>

                <Link
                  className="job-page-record-link"
                  to={`/app/jobs/${state.job.id}/vow`}
                >
                  <span>Visual of Work</span>
                  <strong>View VOW →</strong>
                </Link>

                <button
                  className="job-page-field-switch"
                  disabled={!canEnterFieldMode}
                  type="button"
                  onClick={enterFieldMode}
                >
                  Field Mode
                </button>
              </nav>
            </header>

            <div className="job-page-body">
              <div className="job-page-content">
                <section
                  className="job-page-brief"
                  id="job-overview"
                  aria-labelledby="job-brief-title"
                >
                  <article className="job-page-summary">
                    <header>
                      <div>
                        <p className="eyebrow">AI overview</p>
                        <h2 id="job-brief-title">Job Brief</h2>
                      </div>
                      <button
                        className="job-page-text-action"
                        disabled={summaryState.status === "loading"}
                        type="button"
                        onClick={updateSummary}
                      >
                        {summaryState.status === "loading"
                          ? "Updating…"
                          : "Update summary →"}
                      </button>
                    </header>

                    {summaryState.status === "loading" && (
                      <p className="job-page-summary-status">Building the current Job brief…</p>
                    )}
                    {summaryState.status === "error" && (
                      <p className="job-page-summary-error">{summaryState.message}</p>
                    )}
                    {summaryState.status === "ready" && (
                      <p className="job-page-summary-copy">{summaryState.summary}</p>
                    )}
                  </article>

                  <aside className="job-page-facts">
                    <article>
                      <p className="eyebrow">Approved scope</p>
                      <p>{state.job.description ?? "No approved scope recorded."}</p>
                    </article>
                    <article className="job-current-position">
                      <p className="eyebrow">Current position</p>
                      <div className="job-cycle-history" aria-label="Job cycle history">
                        {Array.from(
                          { length: state.job.currentCycle.cycleNumber },
                          (_, index) => index + 1,
                        ).map((cycleNumber) => {
                          const isCurrent =
                            cycleNumber === state.job.currentCycle.cycleNumber;
                          return (
                            <span
                              className={isCurrent ? "is-current" : "is-closed"}
                              key={cycleNumber}
                            >
                              <b>{cycleNumber}</b>
                              <small>{isCurrent ? currentPositionLabel(state.job) : "Closed"}</small>
                            </span>
                          );
                        })}
                      </div>
                      <div className="job-current-position-copy">
                        <strong>Cycle {state.job.currentCycle.cycleNumber} · {currentPositionLabel(state.job)}</strong>
                        <p>{currentPositionHelp(state.job)}</p>
                      </div>
                    </article>
                  </aside>
                </section>

                <section
                  className="job-page-quick-note"
                  id="job-notes"
                  aria-labelledby="quick-note-title"
                >
                  <div className="job-page-quick-note-label">
                    <p className="eyebrow">Job note</p>
                    <h2 id="quick-note-title">Quick Note</h2>
                  </div>
                  <textarea
                    aria-label="Quick note"
                    disabled={!canEnterFieldMode || quickNoteStatus === "saving"}
                    placeholder={canEnterFieldMode ? "Write a note about this job…" : "Open an active work cycle to add notes."}
                    rows={2}
                    value={quickNote}
                    onChange={(event) => {
                      setQuickNote(event.target.value);
                      if (quickNoteStatus !== "saving") {
                        setQuickNoteStatus("idle");
                        setQuickNoteMessage(null);
                      }
                    }}
                  />
                  <div className="job-page-quick-note-action">
                    <button
                      className="btn btn-primary"
                      disabled={!canEnterFieldMode || !quickNote.trim() || quickNoteStatus === "saving"}
                      type="button"
                      onClick={() => void saveQuickNote()}
                    >
                      {quickNoteStatus === "saving" ? "Saving…" : "Save Note"}
                    </button>
                    {quickNoteMessage && (
                      <span className={quickNoteStatus === "error" ? "is-error" : undefined}>
                        {quickNoteMessage}
                      </span>
                    )}
                  </div>
                </section>

                <section
                  className="job-page-journey"
                  id="job-journey"
                  aria-labelledby="job-journey-title"
                >
                  <header className="job-page-section-heading job-page-journey-heading">
                    <div>
                      <p className="eyebrow">Journey</p>
                      <h2 id="job-journey-title">Job Journey</h2>
                      <p>The complete path of the Job, from opening through every visit, change, closure, and reopen.</p>
                    </div>
                    <span>{state.events.length} records</span>
                  </header>

                  <JourneyLine events={state.events} job={state.job} />
                </section>

                <JobWorkspace
                  job={state.job}
                  onJobChanged={() =>
                    setRefreshVersion((current) => current + 1)
                  }
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
