import type { Job } from "@vizow/shared";
import { useState } from "react";

import { useActiveJob } from "../contexts/ActiveJobContext";
import { AppLayout } from "../layouts/AppLayout";

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAddress(job: Job): string {
  const street = [
    job.serviceAddressLine1,
    job.serviceAddressLine2,
  ]
    .filter(Boolean)
    .join(", ");

  const locality = [
    job.serviceCity,
    job.serviceState,
    job.servicePostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    [street, locality].filter(Boolean).join(", ") ||
    "No service address recorded"
  );
}

export function FieldPage() {
  const {
    jobs,
    activeJob,
    activeJobId,
    status,
    error,
    selectActiveJob,
    reloadJobs,
  } = useActiveJob();

  const [isChangingJob, setIsChangingJob] = useState(false);

  const showJobPicker =
    status === "ready" &&
    (!activeJob || isChangingJob);

  function handleSelectJob(jobId: string): void {
    selectActiveJob(jobId);
    setIsChangingJob(false);
  }

  return (
    <AppLayout
      object={activeJob?.title ?? "No Job Selected"}
      tool="Field"
      action={
        activeJob
          ? "Capture work"
          : "Select a job"
      }
      result={
        status === "loading"
          ? "Loading"
          : status === "error"
            ? "Not loaded"
            : activeJob
              ? `Cycle ${activeJob.currentCycle.cycleNumber}`
              : "Selection required"
      }
      message={
        status === "loading"
          ? "Loading the available jobs."
          : status === "error"
            ? "Jobs could not be loaded. Nothing was changed."
            : activeJob
              ? `${activeJob.title} is the active field job.`
              : "Select a job before recording field work."
      }
      activeStep={
        status === "loading"
          ? "result"
          : activeJob
            ? "action"
            : "object"
      }
      resultTone={
        status === "loading"
          ? "working"
          : status === "error"
            ? "error"
            : activeJob
              ? "success"
              : undefined
      }
    >
      <div className="page field-page">
        <section
          className="field-workspace"
          aria-live="polite"
        >
          {status === "loading" && (
            <div className="notice">
              Loading field jobs…
            </div>
          )}

          {status === "error" && (
            <div
              className="notice notice-error field-error-panel"
              role="alert"
            >
              <strong>Jobs could not be loaded.</strong>
              <p>
                {error ??
                  "An unknown error occurred while loading jobs."}
              </p>

              <button
                className="btn"
                type="button"
                onClick={reloadJobs}
              >
                Try Again
              </button>
            </div>
          )}

          {status === "ready" && jobs.length === 0 && (
            <div className="field-empty-state">
              <p className="eyebrow">Field Work</p>
              <h1>No Jobs Available</h1>
              <p>
                Approve a Request to create a Job and
                Cycle 1.
              </p>
            </div>
          )}

          {showJobPicker && jobs.length > 0 && (
            <section className="field-job-picker">
              <header className="field-section-heading">
                <div>
                  <p className="eyebrow">
                    Active Field Job
                  </p>
                  <h1>
                    {activeJob
                      ? "Change Job"
                      : "Select a Job"}
                  </h1>
                </div>

                {activeJob && (
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setIsChangingJob(false)
                    }
                  >
                    Cancel
                  </button>
                )}
              </header>

              <div className="field-job-list">
                {jobs.map((job) => {
                  const isSelected =
                    job.id === activeJobId;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={
                        isSelected
                          ? "field-job-option field-job-option-selected"
                          : "field-job-option"
                      }
                      key={job.id}
                      type="button"
                      onClick={() =>
                        handleSelectJob(job.id)
                      }
                    >
                      <span className="field-job-option-client">
                        {job.clientName}
                      </span>

                      <strong>{job.title}</strong>

                      <span>
                        {formatAddress(job)}
                      </span>

                      <small>
                        Cycle{" "}
                        {job.currentCycle.cycleNumber}
                        {" · "}
                        {formatLabel(
                          job.currentCycle.stage,
                        )}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {status === "ready" &&
            activeJob &&
            !isChangingJob && (
              <>
                <section className="field-active-job">
                  <div className="field-active-job-top">
                    <div>
                      <p className="eyebrow">
                        Active Field Job
                      </p>
                      <h1>{activeJob.title}</h1>
                    </div>

                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        setIsChangingJob(true)
                      }
                    >
                      Change Job
                    </button>
                  </div>

                  <dl className="field-job-details">
                    <div>
                      <dt>Client</dt>
                      <dd>{activeJob.clientName}</dd>
                    </div>

                    <div>
                      <dt>Address</dt>
                      <dd>
                        {formatAddress(activeJob)}
                      </dd>
                    </div>

                    <div>
                      <dt>Cycle</dt>
                      <dd>
                        {
                          activeJob.currentCycle
                            .cycleNumber
                        }
                      </dd>
                    </div>

                    <div>
                      <dt>Stage</dt>
                      <dd>
                        {formatLabel(
                          activeJob.currentCycle.stage,
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section
                  className="field-action-grid"
                  aria-label="Field actions"
                >
                  <button
                    className="field-action field-action-primary"
                    disabled
                    type="button"
                  >
                    <strong>Take Picture</strong>
                    <span>
                      Photo capture connects next
                    </span>
                  </button>

                  <button
                    className="field-action"
                    disabled
                    type="button"
                  >
                    <strong>Field Note</strong>
                    <span>
                      Note capture connects next
                    </span>
                  </button>
                </section>
              </>
            )}
        </section>
      </div>
    </AppLayout>
  );
}
