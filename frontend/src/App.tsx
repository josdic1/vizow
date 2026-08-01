import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import type { Job } from "@vizow/shared";
import { fetchJobs } from "./api/jobs";

type JobsState =
  | { status: "loading" }
  | { status: "ready"; jobs: Job[] }
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
              </article>
            );
          })}
      </section>
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
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
