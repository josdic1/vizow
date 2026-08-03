import {
  ClientDetailPage } from "./pages/ClientDetailPage";
import { ClientsPage } from "./pages/ClientsPage";
import { useEffect,
  useMemo,
  useState } from "react";
import { Link,
  Navigate,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type { Job } from "@vizow/shared";
import { fetchClient } from "./api/clients";
import { fetchJob, fetchJobs } from "./api/jobs";
import { AdminPageHeader } from "./components/AdminPageHeader";
import { AppLayout } from "./layouts/AppLayout";
import { RequestsPage } from "./pages/RequestsPage";

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
  const [searchParams] = useSearchParams();
  const scopedClientId =
    searchParams.get("clientId") ?? "";

  const [state, setState] = useState<JobsState>({ status: "loading" });
  const [stageFilter, setStageFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<
    "client" | "job" | "address" | "stage" | "cycle"
  >("client");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");

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

  const jobs = state.status === "ready" ? state.jobs : [];

  const scopedJobs = scopedClientId
    ? jobs.filter(
        (job) => job.clientId === scopedClientId,
      )
    : jobs;

  const [scopedClientName, setScopedClientName] =
    useState<string | null>(null);

  useEffect(() => {
    setScopedClientName(null);

    if (!scopedClientId) {
      return;
    }

    const controller = new AbortController();

    fetchClient(scopedClientId, controller.signal)
      .then((client) => {
        setScopedClientName(client.name);
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setScopedClientName(null);
      });

    return () => {
      controller.abort();
    };
  }, [scopedClientId]);

  const scopedClientLabel =
    scopedClientName ?? "Client";

  useEffect(() => {
    setStageFilter("ALL");
    setSearchTerm("");
  }, [scopedClientId]);

  const stages = useMemo(
    () =>
      Array.from(
        new Set(
          scopedJobs.map(
            (job) => job.currentCycle.stage,
          ),
        ),
      ).sort(
        (first, second) => first.localeCompare(second),
      ),
    [scopedJobs],
  );

  const visibleJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const nextJobs = scopedJobs.filter((job) => {
      if (
        stageFilter !== "ALL" &&
        job.currentCycle.stage !== stageFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const address = formatAddress(job) ?? "";

      return [
        job.clientName,
        job.title,
        job.description,
        address,
        job.currentCycle.stage,
        job.currentCycle.reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

    nextJobs.sort((first, second) => {
      let firstValue: string | number;
      let secondValue: string | number;

      if (sortKey === "client") {
        firstValue = first.clientName;
        secondValue = second.clientName;
      } else if (sortKey === "job") {
        firstValue = first.title;
        secondValue = second.title;
      } else if (sortKey === "address") {
        firstValue = formatAddress(first) ?? "";
        secondValue = formatAddress(second) ?? "";
      } else if (sortKey === "stage") {
        firstValue = first.currentCycle.stage;
        secondValue = second.currentCycle.stage;
      } else {
        firstValue = first.currentCycle.cycleNumber;
        secondValue = second.currentCycle.cycleNumber;
      }

      const result =
        typeof firstValue === "number" && typeof secondValue === "number"
          ? firstValue - secondValue
          : String(firstValue).localeCompare(String(secondValue));

      return sortDirection === "ASC" ? result : result * -1;
    });

    return nextJobs;
  }, [
    scopedJobs,
    searchTerm,
    sortDirection,
    sortKey,
    stageFilter,
  ]);

  function handleSort(nextSortKey: typeof sortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) =>
        current === "ASC" ? "DESC" : "ASC",
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("ASC");
  }

  function getSortLabel(column: typeof sortKey) {
    if (sortKey !== column) {
      return "";
    }

    return sortDirection === "ASC" ? " ↑" : " ↓";
  }

  return (
    <AppLayout
      object={
        scopedClientId
          ? scopedClientLabel
          : "All Jobs"
      }
      tool="Jobs"
      action="Review jobs"
      result={
        state.status === "loading"
          ? "Loading"
          : state.status === "error"
            ? "Not loaded"
            : `${scopedJobs.length} job${scopedJobs.length === 1 ? "" : "s"} loaded`
      }
      message={
        state.status === "loading"
          ? "Loading jobs from VIZOW."
          : state.status === "error"
            ? "Jobs could not be loaded. Nothing was changed."
            : `${scopedJobs.length} job${scopedJobs.length === 1 ? "" : "s"} are available to review.`
      }
      activeStep={state.status === "loading" ? "result" : "action"}
      resultTone={
        state.status === "loading"
          ? "working"
          : state.status === "error"
            ? "error"
            : "success"
      }
    >
      <div className="page">
        <div className="admin-page jobs-page">
          <AdminPageHeader
            eyebrow="Visual of Work"
            title={
              scopedClientId
                ? `${scopedClientLabel} Jobs`
                : "Jobs"
            }
            description={
              scopedClientId
                ? `Jobs belonging to ${scopedClientLabel}.`
                : "Review each job’s current stage, service address, and active work cycle."
            }
            meta={
              state.status === "ready" ? (
                <span>
                  {scopedJobs.length} total job
                  {scopedJobs.length === 1 ? "" : "s"}
                </span>
              ) : undefined
            }
          />

          {scopedClientId && (
            <nav
              className="workspace-scope-bar"
              aria-label="Job scope"
            >
              <div>
                <p className="eyebrow">Job Scope</p>
                <strong>{scopedClientLabel}</strong>
              </div>

              <div className="workspace-scope-actions">
                <Link
                  aria-current="page"
                  className="btn btn-primary"
                  to={`/jobs?clientId=${encodeURIComponent(
                    scopedClientId,
                  )}`}
                >
                  This Client
                </Link>

                <Link className="btn" to="/jobs">
                  All Jobs
                </Link>

                <Link
                  className="btn"
                  to={`/clients/${scopedClientId}`}
                >
                  Client Record
                </Link>
              </div>
            </nav>
          )}

          {state.status === "ready" && (
            <div className="admin-toolbar jobs-toolbar">
              <div
                className="admin-filter-tabs"
                aria-label="Job stage filter"
              >
                <button
                  aria-pressed={stageFilter === "ALL"}
                  className={stageFilter === "ALL" ? "is-active" : undefined}
                  type="button"
                  onClick={() => setStageFilter("ALL")}
                >
                  <span>All</span>
                  <strong>{scopedJobs.length}</strong>
                </button>

                {stages.map((stage) => {
                  const count = scopedJobs.filter(
                    (job) => job.currentCycle.stage === stage,
                  ).length;

                  return (
                    <button
                      aria-pressed={stageFilter === stage}
                      className={
                        stageFilter === stage ? "is-active" : undefined
                      }
                      key={stage}
                      type="button"
                      onClick={() => setStageFilter(stage)}
                    >
                      <span>{formatLabel(stage)}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>

              <div className="admin-toolbar-end">
                <label className="admin-search-field">
                  <span className="sr-only">Search jobs</span>
                  <input
                    placeholder="Client, job, address…"
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {state.status === "loading" && (
            <div className="notice">Loading jobs…</div>
          )}

          {state.status === "error" && (
            <div className="notice notice-error" role="alert">
              <strong>Jobs could not be loaded.</strong>
              <p>{state.message}</p>
            </div>
          )}

          {state.status === "ready" && visibleJobs.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table jobs-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        type="button"
                        onClick={() => handleSort("client")}
                      >
                        Client{getSortLabel("client")}
                      </button>
                    </th>

                    <th>
                      <button
                        type="button"
                        onClick={() => handleSort("job")}
                      >
                        Job{getSortLabel("job")}
                      </button>
                    </th>

                    <th>
                      <button
                        type="button"
                        onClick={() => handleSort("address")}
                      >
                        Service address{getSortLabel("address")}
                      </button>
                    </th>

                    <th>
                      <button
                        type="button"
                        onClick={() => handleSort("stage")}
                      >
                        Stage{getSortLabel("stage")}
                      </button>
                    </th>

                    <th>
                      <button
                        type="button"
                        onClick={() => handleSort("cycle")}
                      >
                        Cycle{getSortLabel("cycle")}
                      </button>
                    </th>

                    <th aria-label="Open job" />
                  </tr>
                </thead>

                <tbody>
                  {visibleJobs.map((job) => {
                    const address = formatAddress(job);
                    const stageClass =
                      `admin-status-chip project-status-${job.currentCycle.stage.toLowerCase()}`;

                    return (
                      <tr key={job.id}>
                        <td data-label="Client">
                          <strong>{job.clientName}</strong>
                        </td>

                        <td data-label="Job">
                          <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                          <small>
                            {formatLabel(job.currentCycle.reason)}
                          </small>
                        </td>

                        <td data-label="Service address">
                          {address ?? "—"}
                        </td>

                        <td data-label="Stage">
                          <span className={stageClass}>
                            {formatLabel(job.currentCycle.stage)}
                          </span>
                        </td>

                        <td data-label="Cycle">
                          {job.currentCycle.cycleNumber}
                        </td>

                        <td className="admin-table-action">
                          <Link to={`/jobs/${job.id}`}>Open →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {state.status === "ready" && visibleJobs.length === 0 && (
            <div className="admin-empty-state admin-empty-state-large">
              <strong>No jobs match this view.</strong>
              <span>Choose another stage or clear the search.</span>
              <button
                type="button"
                onClick={() => {
                  setStageFilter("ALL");
                  setSearchTerm("");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function JobDetailContent({ job }: { job: Job }) {
  const address = formatAddress(job);
  const stageClass =
    `admin-status-chip project-status-${job.currentCycle.stage.toLowerCase()}`;

  return (
    <>
      <AdminPageHeader
        eyebrow={job.clientName}
        title={job.title}
        description={
          job.description ??
          "Review this job’s current work cycle and service information."
        }
        actions={
          <Link className="btn" to="/jobs">
            ← Jobs
          </Link>
        }
        meta={
          <>
            <span>Stage: {formatLabel(job.currentCycle.stage)}</span>
            <span>Cycle {job.currentCycle.cycleNumber}</span>
          </>
        }
      />

      <section className="helper-card stack-lg">
        <div className="card-topline">
          <div className="stack">
            <p className="eyebrow">Current Work Cycle</p>
            <h2>Job Record</h2>
          </div>

          <span className={stageClass}>
            {formatLabel(job.currentCycle.stage)}
          </span>
        </div>

        <div className="mosaic-detail-grid">
          <div>
            <span>Object</span>
            <strong>Job</strong>
          </div>

          <div>
            <span>Client</span>
            <strong>{job.clientName}</strong>
          </div>

          <div>
            <span>Cycle</span>
            <strong>{job.currentCycle.cycleNumber}</strong>
          </div>

          <div>
            <span>Reason</span>
            <strong>{formatLabel(job.currentCycle.reason)}</strong>
          </div>
        </div>

        <div className="grid-2">
          <div className="card-drawer">
            <p className="eyebrow">Service Address</p>
            <p>{address ?? "No service address recorded."}</p>
          </div>

          <div className="card-drawer">
            <p className="eyebrow">Scope</p>
            <p>{job.description ?? "No scope description recorded."}</p>
          </div>
        </div>
      </section>
    </>
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
    <AppLayout
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
    >
      <div className="page">
        <div className="admin-page job-detail-page">
          {state.status === "loading" && (
            <div className="notice">Loading job…</div>
          )}

          {state.status === "error" && (
            <>
              <div className="cluster">
                <Link className="btn" to="/jobs">
                  ← Jobs
                </Link>
              </div>

              <div className="notice notice-error" role="alert">
                <strong>Job could not be loaded.</strong>
                <p>{state.message}</p>
              </div>
            </>
          )}

          {state.status === "ready" && (
            <JobDetailContent job={state.job} />
          )}
        </div>
      </div>
    </AppLayout>
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
            <Link className="btn btn-primary" to="/requests">
              Return to Requests
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
      <Route path="/" element={<Navigate to="/requests" replace />} />
      <Route path="/requests" element={<RequestsPage />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
          <Route path="/clients" element={<ClientsPage />} />
      <Route
        path="/clients/:clientId"
        element={<ClientDetailPage />}
      />
    </Routes>
  );
}

export default App;
