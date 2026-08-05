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
} from "react-router";
import type { Job } from "@vizow/shared";
import { fetchClient } from "./api/clients";
import {
  archiveJob,
  cancelJob,
  fetchJob,
  fetchJobs,
  unarchiveJob,
} from "./api/jobs";
import { AdminPageHeader } from "./components/AdminPageHeader";
import { useActiveJob } from "./contexts/ActiveJobContext";
import { AppLayout } from "./layouts/AppLayout";
import { FieldPage } from "./pages/FieldPage";
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
  const [archiveFilter, setArchiveFilter] = useState<
    "CURRENT" | "ARCHIVED"
  >("CURRENT");
  const [sortKey, setSortKey] = useState<
    "client" | "job" | "address" | "stage" | "cycle"
  >("client");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");

  useEffect(() => {
    const controller = new AbortController();

    fetchJobs(controller.signal, true)
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

  const currentJobCount = scopedJobs.filter(
    (job) => job.archivedAt === null,
  ).length;

  const archivedJobCount = scopedJobs.filter(
    (job) => job.archivedAt !== null,
  ).length;

  const viewJobs = scopedJobs.filter((job) =>
    archiveFilter === "ARCHIVED"
      ? job.archivedAt !== null
      : job.archivedAt === null,
  );

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
    setArchiveFilter("CURRENT");
    setStageFilter("ALL");
    setSearchTerm("");
  }, [scopedClientId]);

  useEffect(() => {
    setStageFilter("ALL");
    setSearchTerm("");
  }, [archiveFilter]);

  const stages = useMemo(
    () =>
      Array.from(
        new Set(
          viewJobs.map(
            (job) => job.currentCycle.stage,
          ),
        ),
      ).sort(
        (first, second) => first.localeCompare(second),
      ),
    [viewJobs],
  );

  const visibleJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const nextJobs = viewJobs.filter((job) => {
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
    viewJobs,
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
                <>
                  <span>
                    {currentJobCount} current
                  </span>
                  <span>
                    {archivedJobCount} archived
                  </span>
                </>
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
                aria-label="Job archive filter"
              >
                <button
                  aria-pressed={archiveFilter === "CURRENT"}
                  className={
                    archiveFilter === "CURRENT"
                      ? "is-active"
                      : undefined
                  }
                  type="button"
                  onClick={() => setArchiveFilter("CURRENT")}
                >
                  <span>Current</span>
                  <strong>{currentJobCount}</strong>
                </button>

                <button
                  aria-pressed={archiveFilter === "ARCHIVED"}
                  className={
                    archiveFilter === "ARCHIVED"
                      ? "is-active"
                      : undefined
                  }
                  type="button"
                  onClick={() => setArchiveFilter("ARCHIVED")}
                >
                  <span>Archived</span>
                  <strong>{archivedJobCount}</strong>
                </button>
              </div>
            </div>
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
                  <strong>{viewJobs.length}</strong>
                </button>

                {stages.map((stage) => {
                  const count = viewJobs.filter(
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
                            {" · "}
                            {job.archivedAt
                              ? "Archived"
                              : job.lifecycleStatus === "cancelled"
                                ? "Cancelled"
                                : "Active"}
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
              <strong>
                {archiveFilter === "ARCHIVED"
                  ? "No archived Jobs match this view."
                  : "No current Jobs match this view."}
              </strong>
              <span>
                Choose another stage or clear the search.
              </span>
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

type JobDetailContentProps = {
  job: Job;
  onJobUpdated: (job: Job) => void;
};

function JobDetailContent({
  job,
  onJobUpdated,
}: JobDetailContentProps) {
  const {
    activeJobId,
    clearActiveJob,
    reloadJobs,
    selectActiveJob,
  } = useActiveJob();

  const [showCancelForm, setShowCancelForm] =
    useState(false);
  const [cancellationReason, setCancellationReason] =
    useState("");
  const [actionStatus, setActionStatus] = useState<
    "idle" | "working" | "success" | "error"
  >("idle");
  const [actionMessage, setActionMessage] =
    useState<string | null>(null);

  const address = formatAddress(job);
  const stageClass =
    `admin-status-chip project-status-${job.currentCycle.stage.toLowerCase()}`;

  const isArchived = job.archivedAt !== null;
  const isCancelled =
    job.lifecycleStatus === "cancelled";

  const canOpenField =
    !isArchived &&
    !isCancelled &&
    job.currentCycle.stage === "project";

  const canCancel = canOpenField;

  const canArchive =
    !isArchived &&
    (
      isCancelled ||
      job.currentCycle.stage === "completed"
    );

  function finishAction(
    updatedJob: Job,
    message: string,
    clearSelection: boolean,
  ): void {
    onJobUpdated(updatedJob);

    if (
      clearSelection &&
      activeJobId === updatedJob.id
    ) {
      clearActiveJob();
    }

    reloadJobs();
    setActionStatus("success");
    setActionMessage(message);
    setShowCancelForm(false);
    setCancellationReason("");
  }

  async function handleCancelJob(): Promise<void> {
    const reason = cancellationReason.trim();

    if (!reason || actionStatus === "working") {
      return;
    }

    setActionStatus("working");
    setActionMessage(null);

    try {
      const updatedJob = await cancelJob(
        job.id,
        { reason },
      );

      finishAction(
        updatedJob,
        "Job cancelled. Its complete history was preserved.",
        true,
      );
    } catch (error: unknown) {
      setActionStatus("error");
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel the Job.",
      );
    }
  }

  async function handleArchiveJob(): Promise<void> {
    if (
      actionStatus === "working" ||
      !window.confirm(
        "Archive this Job? It will be hidden from the normal Jobs list, but nothing will be deleted.",
      )
    ) {
      return;
    }

    setActionStatus("working");
    setActionMessage(null);

    try {
      const updatedJob = await archiveJob(job.id);

      finishAction(
        updatedJob,
        "Job archived. No history or media was deleted.",
        true,
      );
    } catch (error: unknown) {
      setActionStatus("error");
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to archive the Job.",
      );
    }
  }

  async function handleUnarchiveJob(): Promise<void> {
    if (actionStatus === "working") {
      return;
    }

    setActionStatus("working");
    setActionMessage(null);

    try {
      const updatedJob = await unarchiveJob(job.id);

      finishAction(
        updatedJob,
        "Job restored to the normal Jobs list.",
        false,
      );
    } catch (error: unknown) {
      setActionStatus("error");
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to unarchive the Job.",
      );
    }
  }

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
          <div className="cluster">
            <Link className="btn" to="/jobs">
              ← Jobs
            </Link>

            {canOpenField && (
              <Link
                className="btn btn-primary"
                to="/field"
                onClick={() => {
                  selectActiveJob(job.id);
                }}
              >
                Open Field Mode
              </Link>
            )}
          </div>
        }
        meta={
          <>
            <span>
              Stage:{" "}
              {formatLabel(job.currentCycle.stage)}
            </span>
            <span>
              Status:{" "}
              {isArchived
                ? "Archived"
                : formatLabel(job.lifecycleStatus)}
            </span>
            <span>
              Cycle {job.currentCycle.cycleNumber}
            </span>
          </>
        }
      />

      <section className="helper-card stack-lg">
        <div className="card-topline">
          <div className="stack">
            <p className="eyebrow">
              Job Actions
            </p>
            <h2>Manage Job</h2>
          </div>

          <div className="cluster">
            {canCancel && (
              <button
                className="btn"
                type="button"
                disabled={actionStatus === "working"}
                onClick={() => {
                  setShowCancelForm((current) => !current);
                  setActionStatus("idle");
                  setActionMessage(null);
                }}
              >
                Cancel Job
              </button>
            )}

            {canArchive && (
              <button
                className="btn"
                type="button"
                disabled={actionStatus === "working"}
                onClick={() => {
                  void handleArchiveJob();
                }}
              >
                Archive Job
              </button>
            )}

            {isArchived && (
              <button
                className="btn btn-primary"
                type="button"
                disabled={actionStatus === "working"}
                onClick={() => {
                  void handleUnarchiveJob();
                }}
              >
                Unarchive Job
              </button>
            )}
          </div>
        </div>

        {showCancelForm && canCancel && (
          <div className="card-drawer stack">
            <label htmlFor="job-cancellation-reason">
              <strong>Cancellation reason</strong>
            </label>

            <textarea
              className="textarea"
              id="job-cancellation-reason"
              maxLength={1000}
              placeholder="Why is this Job being cancelled?"
              value={cancellationReason}
              onChange={(event) => {
                setCancellationReason(
                  event.currentTarget.value,
                );
              }}
            />

            <div className="cluster">
              <button
                className="btn"
                type="button"
                disabled={actionStatus === "working"}
                onClick={() => {
                  setShowCancelForm(false);
                  setCancellationReason("");
                  setActionStatus("idle");
                  setActionMessage(null);
                }}
              >
                Keep Job Active
              </button>

              <button
                className="btn btn-primary"
                type="button"
                disabled={
                  actionStatus === "working" ||
                  cancellationReason.trim() === ""
                }
                onClick={() => {
                  void handleCancelJob();
                }}
              >
                {actionStatus === "working"
                  ? "Cancelling…"
                  : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        )}

        {actionMessage && (
          <div
            className={
              actionStatus === "error"
                ? "notice notice-error"
                : "notice"
            }
            role={
              actionStatus === "error"
                ? "alert"
                : "status"
            }
          >
            {actionMessage}
          </div>
        )}
      </section>

      <section className="helper-card stack-lg">
        <div className="card-topline">
          <div className="stack">
            <p className="eyebrow">
              Current Work Cycle
            </p>
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
            <strong>
              {job.currentCycle.cycleNumber}
            </strong>
          </div>

          <div>
            <span>Reason</span>
            <strong>
              {formatLabel(job.currentCycle.reason)}
            </strong>
          </div>

          <div>
            <span>Lifecycle</span>
            <strong>
              {formatLabel(job.lifecycleStatus)}
            </strong>
          </div>

          <div>
            <span>Archive</span>
            <strong>
              {isArchived ? "Archived" : "Not archived"}
            </strong>
          </div>
        </div>

        {isCancelled && (
          <div className="card-drawer">
            <p className="eyebrow">
              Cancellation Reason
            </p>
            <p>
              {job.cancellationReason ??
                "No cancellation reason recorded."}
            </p>
          </div>
        )}

        <div className="grid-2">
          <div className="card-drawer">
            <p className="eyebrow">
              Service Address
            </p>
            <p>
              {address ??
                "No service address recorded."}
            </p>
          </div>

          <div className="card-drawer">
            <p className="eyebrow">Scope</p>
            <p>
              {job.description ??
                "No scope description recorded."}
            </p>
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
            <JobDetailContent
              job={state.job}
              onJobUpdated={(job) => {
                setState({ status: "ready", job });
              }}
            />
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
      <Route path="/field" element={<FieldPage />} />
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
