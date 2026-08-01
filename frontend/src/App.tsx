import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import type { Job } from "@vizow/shared";
import { fetchJob, fetchJobs } from "./api/jobs";

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
      <header>
        <p>Visual of Work</p>
        <h1>VIZOW</h1>
      </header>

      <section aria-labelledby="jobs-heading">
        <h2 id="jobs-heading">Jobs</h2>

        {state.status === "loading" && <p>Loading jobs…</p>}

        {state.status === "error" && (
          <div role="alert">
            <strong>Jobs could not be loaded.</strong>
            <p>{state.message}</p>
          </div>
        )}

        {state.status === "ready" && state.jobs.length === 0 && (
          <p>No jobs have been created yet.</p>
        )}

        {state.status === "ready" &&
          state.jobs.map((job) => {
            const address = formatAddress(job);

            return (
              <article key={job.id}>
                <header>
                  <p>{job.clientName}</p>
                  <h3>{job.title}</h3>
                </header>

                <dl>
                  <div>
                    <dt>Stage</dt>
                    <dd>{formatLabel(job.currentCycle.stage)}</dd>
                  </div>

                  <div>
                    <dt>Cycle</dt>
                    <dd>
                      {job.currentCycle.cycleNumber} ·{" "}
                      {formatLabel(job.currentCycle.reason)}
                    </dd>
                  </div>

                  {address && (
                    <div>
                      <dt>Service address</dt>
                      <dd>{address}</dd>
                    </div>
                  )}
                </dl>

                {job.description && <p>{job.description}</p>}

                <Link to={`/jobs/${job.id}`}>View job</Link>
              </article>
            );
          })}
      </section>
    </main>
  );
}


function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [state, setState] = useState<JobDetailState>({ status: "loading" });

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
      <header>
        <Link to="/jobs">← Jobs</Link>
        <p>Visual of Work</p>
        <h1>VIZOW</h1>
      </header>

      {state.status === "loading" && <p>Loading job…</p>}

      {state.status === "error" && (
        <div role="alert">
          <strong>Job could not be loaded.</strong>
          <p>{state.message}</p>
        </div>
      )}

      {state.status === "ready" && (
        <section aria-labelledby="job-heading">
          <p>{state.job.clientName}</p>
          <h2 id="job-heading">{state.job.title}</h2>

          <dl>
            <div>
              <dt>Stage</dt>
              <dd>{formatLabel(state.job.currentCycle.stage)}</dd>
            </div>

            <div>
              <dt>Cycle</dt>
              <dd>
                {state.job.currentCycle.cycleNumber} ·{" "}
                {formatLabel(state.job.currentCycle.reason)}
              </dd>
            </div>

            {formatAddress(state.job) && (
              <div>
                <dt>Service address</dt>
                <dd>{formatAddress(state.job)}</dd>
              </div>
            )}
          </dl>

          {state.job.description && <p>{state.job.description}</p>}
        </section>
      )}
    </main>
  );
}


function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link to="/jobs">Return to jobs</Link>
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
