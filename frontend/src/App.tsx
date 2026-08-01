import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import type { Job } from "@vizow/shared";
import { fetchJob, fetchJobs } from "./api/jobs";
import { ContextRail } from "./components/ContextRail";

type JobsState =
  | { status: "loading" }
  | { status: "ready"; jobs: Job[] }
  | { status: "error"; message: string };

type JobDetailState =
  | { status: "loading" }
  | { status: "ready"; job: Job }
  | { status: "error"; message: string };

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAddress(job: Job): string | null {
  const street = [job.serviceAddressLine1, job.serviceAddressLine2]
    .filter(Boolean)
    .join(", ");

  const locality = [
    job.serviceCity,
    job.serviceState,
    job.servicePostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  return [street, locality].filter(Boolean).join(", ") || null;
}

function JobsPage() {
  const [state, setState] = useState<JobsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetchJobs(controller.signal)
      .then((jobs) => {
        setState({ status: "ready", jobs });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "An unknown error occurred while loading jobs.",
        });
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main>
      <ContextRail
        object="All Jobs"
        tool="Jobs"
        action="Review jobs"
        result={
          state.status === "loading"
            ? "Loading"
            : state.status === "error"
              ? "Not loaded"
              : `${state.jobs.length} job${state.jobs.length === 1 ? "" : "s"} loaded`
        }
        message={
          state.status === "loading"
            ? "Loading jobs from VIZOW."
            : state.status === "error"
              ? "Jobs could not be loaded. Nothing was changed."
              : `${state.jobs.length} job${state.jobs.length === 1 ? "" : "s"} are available to review.`
        }
        activeStep={state.status === "loading" ? "result" : "action"}
        resultTone={
          state.status === "loading"
            ? "working"
            : state.status === "error"
              ? "error"
              : "success"
        }
      />

      <div className="page">
        <div className="shell stack-lg">
          <header className="stack">
            <p className="eyebrow">Visual of Work</p>
            <h1 className="title">VIZOW</h1>
          </header>

          <section className="stack" aria-labelledby="jobs-heading">
            <div className="card-topline">
              <div className="stack">
                <p className="eyebrow">Workspace</p>
                <h2 id="jobs-heading">Jobs</h2>
              </div>

              {state.status === "ready" && (
                <span className="badge">
                  {state.jobs.length}{" "}
                  {state.jobs.length === 1 ? "Job" : "Jobs"}
                </span>
              )}
            </div>

            {state.status === "loading" && (
              <div className="panel">
                <p>Loading jobs…</p>
              </div>
            )}

            {state.status === "error" && (
              <div className="panel stack" role="alert">
                <strong>Jobs could not be loaded.</strong>
                <p>{state.message}</p>
              </div>
            )}

            {state.status === "ready" && state.jobs.length === 0 && (
              <div className="panel">
                <p>No jobs have been created yet.</p>
              </div>
            )}

            {state.status === "ready" &&
              state.jobs.map((job) => {
                const address = formatAddress(job);

                return (
                  <article className="panel stack" key={job.id}>
                    <div className="card-topline">
                      <div className="stack">
                        <p className="eyebrow">{job.clientName}</p>
                        <h3>{job.title}</h3>
                      </div>

                      <div className="card-markers">
                        <span className="card-marker card-marker-strong">
                          {formatLabel(job.currentCycle.stage)}
                        </span>

                        <span className="card-marker">
                          Cycle {job.currentCycle.cycleNumber}
                        </span>
                      </div>
                    </div>

                    <dl className="grid-2">
                      <div>
                        <dt className="label">Cycle reason</dt>
                        <dd>{formatLabel(job.currentCycle.reason)}</dd>
                      </div>

                      {address && (
                        <div>
                          <dt className="label">Service address</dt>
                          <dd>{address}</dd>
                        </div>
                      )}
                    </dl>

                    {job.description && (
                      <p className="subtitle">{job.description}</p>
                    )}

                    <div className="cluster">
                      <Link
                        className="btn btn-primary"
                        to={`/jobs/${job.id}`}
                      >
                        View job
                      </Link>
                    </div>
                  </article>
                );
              })}
          </section>
        </div>
      </div>
    </main>
  );
}

function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [state, setState] = useState<JobDetailState>({
    status: "loading",
  });

  useEffect(() => {
    if (!jobId) {
      setState({
        status: "error",
        message: "The job ID is missing from the URL.",
      });
      return;
    }

    const controller = new AbortController();

    setState({ status: "loading" });

    fetchJob(jobId, controller.signal)
      .then((job) => {
        setState({ status: "ready", job });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "An unknown error occurred while loading the job.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [jobId]);

  return (
    <main>
      <ContextRail
        object={
          state.status === "ready"
            ? state.job.title
            : jobId
              ? "Selected job"
              : undefined
        }
        tool="Jobs"
        action="Review job"
        result={
          state.status === "loading"
            ? "Loading"
            : state.status === "error"
              ? "Not loaded"
              : "Loaded"
        }
        message={
          state.status === "loading"
            ? "Loading this job from VIZOW."
            : state.status === "error"
              ? "This job could not be loaded. Nothing was changed."
              : `${state.job.title} is loaded from Cycle ${state.job.currentCycle.cycleNumber}.`
        }
        activeStep={state.status === "loading" ? "result" : "action"}
        resultTone={
          state.status === "loading"
            ? "working"
            : state.status === "error"
              ? "error"
              : "success"
        }
      />

      <div className="page">
        <div className="shell stack-lg">
          <header className="stack">
            <div className="cluster">
              <Link className="btn" to="/jobs">
                ← Jobs
              </Link>
            </div>

            <p className="eyebrow">Visual of Work</p>
            <h1 className="title">VIZOW</h1>
          </header>

          {state.status === "loading" && (
            <div className="panel">
              <p>Loading job…</p>
            </div>
          )}

          {state.status === "error" && (
            <div className="panel stack" role="alert">
              <strong>Job could not be loaded.</strong>
              <p>{state.message}</p>
            </div>
          )}

          {state.status === "ready" && (
            <section
              className="panel stack-lg"
              aria-labelledby="job-heading"
            >
              <div className="card-topline">
                <div className="stack">
                  <p className="eyebrow">{state.job.clientName}</p>
                  <h2 id="job-heading">{state.job.title}</h2>
                </div>

                <div className="card-markers">
                  <span className="card-marker card-marker-strong">
                    {formatLabel(state.job.currentCycle.stage)}
                  </span>

                  <span className="card-marker">
                    Cycle {state.job.currentCycle.cycleNumber}
                  </span>
                </div>
              </div>

              <dl className="grid-2">
                <div>
                  <dt className="label">Cycle reason</dt>
                  <dd>{formatLabel(state.job.currentCycle.reason)}</dd>
                </div>

                {formatAddress(state.job) && (
                  <div>
                    <dt className="label">Service address</dt>
                    <dd>{formatAddress(state.job)}</dd>
                  </div>
                )}
              </dl>

              {state.job.description && (
                <p className="subtitle">{state.job.description}</p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="page">
      <div className="shell">
        <section className="panel stack">
          <p className="eyebrow">Navigation</p>
          <h1>Page not found</h1>
          <div className="cluster">
            <Link className="btn btn-primary" to="/jobs">
              Return to jobs
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/jobs" replace />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
