import type { Job } from "@vizow/shared";
import { useState } from "react";

import {
  CloseJobCycleWarningError,
  archiveJob,
  cancelJob,
  closeJobCycle,
  reopenJobCycle,
  unarchiveJob,
} from "../api/jobs";
import { JobMediaLibrary } from "./JobMediaLibrary";
import { ScopeRevisionControl } from "./ScopeRevisionControl";
import { ScopeRevisionLedger } from "./ScopeRevisionLedger";
import { VisitControl } from "./VisitControl";

type JobWorkspaceProps = {
  job: Job;
  onJobChanged: () => void;
};

type ActionStatus = "idle" | "working" | "success" | "error";

export function JobWorkspace({
  job,
  onJobChanged,
}: JobWorkspaceProps) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [actionStatus, setActionStatus] =
    useState<ActionStatus>("idle");
  const [actionMessage, setActionMessage] =
    useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const isWritable =
    job.lifecycleStatus === "active" &&
    job.archivedAt === null &&
    job.currentCycle.stage === "open";
  const canReopen =
    job.lifecycleStatus === "active" &&
    job.archivedAt === null &&
    job.currentCycle.stage === "completed";

  function refreshWork(): void {
    setRefreshVersion((current) => current + 1);
  }

  function reportError(error: unknown, fallback: string): void {
    setActionStatus("error");
    setActionMessage(error instanceof Error ? error.message : fallback);
  }

  async function handleCloseCycle(): Promise<void> {
    if (!isWritable || actionStatus === "working") return;

    if (
      !window.confirm(
        `Close Cycle ${job.currentCycle.cycleNumber} for ${job.title}?`,
      )
    ) {
      return;
    }

    setActionStatus("working");
    setActionMessage(null);

    try {
      let confirmScopeVisitWarnings = false;

      while (true) {
        try {
          await closeJobCycle(job.id, {
            finalPrice: null,
            notes: null,
            confirmScopeVisitWarnings,
          });
          break;
        } catch (error: unknown) {
          if (
            !confirmScopeVisitWarnings &&
            error instanceof CloseJobCycleWarningError
          ) {
            const warnings = error.warnings.map((warning) => {
              const problem =
                warning.code === "visit_decision_undecided"
                  ? "Visit decision is still undecided"
                  : warning.code === "required_visit_missing"
                    ? "Required Visit is missing"
                    : "Required Visit is not completed";

              return `Revision ${warning.revisionNumber}: ${problem}\n${warning.scopeText}`;
            });

            if (
              !window.confirm(
                [
                  "This Cycle has unresolved Scope Revision / Visit items:",
                  "",
                  ...warnings,
                  "",
                  "Close the Cycle anyway?",
                ].join("\n\n"),
              )
            ) {
              setActionStatus("idle");
              setActionMessage("Cycle remains open.");
              return;
            }

            confirmScopeVisitWarnings = true;
            continue;
          }

          throw error;
        }
      }

      setActionStatus("success");
      setActionMessage(`Cycle ${job.currentCycle.cycleNumber} closed.`);
      onJobChanged();
    } catch (error: unknown) {
      reportError(error, "Unable to close the Cycle.");
    }
  }

  async function handleReopenCycle(): Promise<void> {
    if (!canReopen || actionStatus === "working") return;

    const nextCycle = job.currentCycle.cycleNumber + 1;
    if (!window.confirm(`Open Cycle ${nextCycle} for ${job.title}?`)) return;

    setActionStatus("working");
    setActionMessage(null);

    try {
      await reopenJobCycle(job.id);
      setActionStatus("success");
      setActionMessage(`Cycle ${nextCycle} opened.`);
      onJobChanged();
    } catch (error: unknown) {
      reportError(error, "Unable to reopen the Job.");
    }
  }

  async function handleCancelJob(): Promise<void> {
    const reason = cancellationReason.trim();
    if (!reason || actionStatus === "working") return;

    if (!window.confirm("Cancel this Job? Its history and media will be kept.")) {
      return;
    }

    setActionStatus("working");
    setActionMessage(null);

    try {
      await cancelJob(job.id, { reason });
      setShowCancelForm(false);
      setCancellationReason("");
      setActionStatus("success");
      setActionMessage("Job cancelled. Its history and media were kept.");
      onJobChanged();
    } catch (error: unknown) {
      reportError(error, "Unable to cancel the Job.");
    }
  }

  async function handleArchiveJob(): Promise<void> {
    if (actionStatus === "working") return;

    if (
      !window.confirm(
        "Archive this Job? It will leave the normal Jobs list, but nothing will be deleted.",
      )
    ) {
      return;
    }

    setActionStatus("working");
    setActionMessage(null);

    try {
      await archiveJob(job.id);
      setActionStatus("success");
      setActionMessage("Job archived. Nothing was deleted.");
      onJobChanged();
    } catch (error: unknown) {
      reportError(error, "Unable to archive the Job.");
    }
  }

  async function handleUnarchiveJob(): Promise<void> {
    if (actionStatus === "working") return;

    setActionStatus("working");
    setActionMessage(null);

    try {
      await unarchiveJob(job.id);
      setActionStatus("success");
      setActionMessage("Job restored to the Jobs list.");
      onJobChanged();
    } catch (error: unknown) {
      reportError(error, "Unable to restore the Job.");
    }
  }

  return (
    <div className="job-workspace">
      <section
        className="job-workspace-section"
        id="job-scope"
        aria-labelledby="scope-title"
      >
        <header className="job-workspace-heading">
          <div>
            <p className="eyebrow">Work</p>
            <h2 id="scope-title">Scope Changes</h2>
          </div>
        </header>
        <ScopeRevisionControl
          key={`${job.id}:${job.currentCycle.id}:${job.currentCycle.stage}`}
          job={job}
          onVisitsChanged={refreshWork}
        />
        <ScopeRevisionLedger
          job={job}
          refreshKey={refreshVersion}
          onChanged={refreshWork}
        />
      </section>

      <section
        className="job-workspace-section"
        id="job-visits"
        aria-labelledby="visits-title"
      >
        <header className="job-workspace-heading">
          <div>
            <p className="eyebrow">Schedule</p>
            <h2 id="visits-title">Visits</h2>
          </div>
        </header>
        <VisitControl
          key={`visits:${job.id}:${job.currentCycle.id}:${job.currentCycle.stage}`}
          job={job}
          refreshKey={refreshVersion}
        />
      </section>

      <section
        className="job-workspace-section"
        id="job-photos"
        aria-labelledby="media-title"
      >
        <header className="job-workspace-heading job-workspace-media-heading">
          <div>
            <p className="eyebrow">Evidence</p>
            <h2 id="media-title">Photos</h2>
          </div>
          <p>Photos, notes, visits, and scope changes become part of the Job Journey and VOW automatically.</p>
        </header>
        <JobMediaLibrary jobId={job.id} refreshKey={refreshVersion} />
      </section>

      <details className="job-workspace-manage">
        <summary>Manage Job</summary>
        <div className="job-workspace-manage-body">
          <div className="job-workspace-manage-actions">
            <button
              className="btn btn-primary"
              disabled={!isWritable || actionStatus === "working"}
              type="button"
              onClick={() => void handleCloseCycle()}
            >
              {actionStatus === "working" ? "Working…" : "Close Current Cycle"}
            </button>

            <button
              className="btn"
              disabled={!canReopen || actionStatus === "working"}
              type="button"
              onClick={() => void handleReopenCycle()}
            >
              Open Cycle {job.currentCycle.cycleNumber + 1}
            </button>

            {job.archivedAt ? (
              <button
                className="btn"
                disabled={actionStatus === "working"}
                type="button"
                onClick={() => void handleUnarchiveJob()}
              >
                Restore Job
              </button>
            ) : (
              <button
                className="btn"
                disabled={actionStatus === "working"}
                type="button"
                onClick={() => void handleArchiveJob()}
              >
                Archive Job
              </button>
            )}

            {job.lifecycleStatus === "active" && !showCancelForm && (
              <button
                className="btn"
                disabled={actionStatus === "working"}
                type="button"
                onClick={() => setShowCancelForm(true)}
              >
                Cancel Job
              </button>
            )}
          </div>

          {showCancelForm && (
            <div className="job-workspace-cancel">
              <label htmlFor="job-cancellation-reason">Cancellation reason</label>
              <textarea
                className="textarea"
                id="job-cancellation-reason"
                value={cancellationReason}
                onChange={(event) => setCancellationReason(event.target.value)}
              />
              <div className="cluster">
                <button className="btn" type="button" onClick={() => setShowCancelForm(false)}>
                  Keep Job
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!cancellationReason.trim() || actionStatus === "working"}
                  type="button"
                  onClick={() => void handleCancelJob()}
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          )}

          {actionMessage && (
            <div
              className={actionStatus === "error" ? "notice notice-error" : "notice notice-success"}
              role={actionStatus === "error" ? "alert" : "status"}
            >
              {actionMessage}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
