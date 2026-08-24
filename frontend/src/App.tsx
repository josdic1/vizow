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
  useLocation,
  useParams,
  useSearchParams,
} from "react-router";
import type {
  Job,
  JobJourneyEvent,
  PersistedJourneySummary,
  Vow,
} from "@vizow/shared";
import { fetchClient } from "./api/clients";
import {
  archiveJob,
  cancelJob,
  fetchJob,
  fetchJobJourney,
  fetchJobJourneySummary,
  fetchJobs,
  summarizeJobJourney,
  unarchiveJob,
} from "./api/jobs";
import { AdminPageHeader } from "./components/AdminPageHeader";
import { WorkspaceHero } from "./components/WorkspaceHero";
import { useActiveJob } from "./contexts/ActiveJobContext";
import { AppLayout } from "./layouts/AppLayout";
import { Today } from "./pages/Today";
import { CalendarPage } from "./pages/CalendarPage";
import { MediaLibraryPage } from "./pages/MediaLibraryPage";
import { ReportingPage } from "./pages/ReportingPage";
import { BusinessDataPage } from "./pages/BusinessDataPage";
import { FieldModePage } from "./pages/FieldModePage";
import { Eli5Page } from "./pages/Eli5Page";
import { DemoPage } from "./pages/DemoPage";
import { DemoProvider } from "./demo/DemoProvider";
import { NailedItPage } from "./pages/NailedItPage";
import { InboxPage } from "./pages/RequestsPage";
import { JobPage } from "./pages/JobPage";
import { JobVowPage } from "./pages/JobVowPage";
import { PublicRequestPage } from "./pages/PublicRequestPage";
import { PublicCalendarPage } from "./pages/PublicCalendarPage";
import {
  VowDetailPage,
  VowsPage,
} from "./pages/VowsPage";
import { fetchVows } from "./api/vows";
import { shouldDefaultToFieldMode } from "./utils/appEntry";

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

function asJourneyRecord(
  value: unknown,
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function journeyText(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];

  return typeof value === "string" && value.trim()
    ? value
    : null;
}

function journeyValue(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function formatJourneyDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
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
  const [jobStatusFilter, setJobStatusFilter] = useState<
    "ACTIVE" | "COMPLETED" | "CANCELLED" | "ARCHIVED" | "ALL"
  >("ACTIVE");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<
    "client" | "job" | "address" | "updated"
  >("updated");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");

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

  function getJobDisplayStatus(
    job: Job,
  ): "ACTIVE" | "COMPLETED" | "CANCELLED" | "ARCHIVED" {
    if (job.archivedAt !== null) {
      return "ARCHIVED";
    }

    if (job.lifecycleStatus === "cancelled") {
      return "CANCELLED";
    }

    if (job.currentCycle.stage === "completed") {
      return "COMPLETED";
    }

    return "ACTIVE";
  }

  const activeJobCount = scopedJobs.filter(
    (job) => getJobDisplayStatus(job) === "ACTIVE",
  ).length;

  const completedJobCount = scopedJobs.filter(
    (job) => getJobDisplayStatus(job) === "COMPLETED",
  ).length;

  const cancelledJobCount = scopedJobs.filter(
    (job) => getJobDisplayStatus(job) === "CANCELLED",
  ).length;

  const archivedJobCount = scopedJobs.filter(
    (job) => getJobDisplayStatus(job) === "ARCHIVED",
  ).length;

  const viewJobs = scopedJobs.filter(
    (job) =>
      jobStatusFilter === "ALL" ||
      getJobDisplayStatus(job) === jobStatusFilter,
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
    setJobStatusFilter("ACTIVE");
    setSearchTerm("");
    setSortKey("updated");
    setSortDirection("DESC");
  }, [scopedClientId]);

  const visibleJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const nextJobs = viewJobs.filter((job) => {
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
      let result = 0;

      if (sortKey === "client") {
        result = first.clientName.localeCompare(second.clientName);
      } else if (sortKey === "job") {
        result = first.title.localeCompare(second.title);
      } else if (sortKey === "address") {
        result = (formatAddress(first) ?? "").localeCompare(
          formatAddress(second) ?? "",
        );
      } else {
        result =
          new Date(first.updatedAt).getTime() -
          new Date(second.updatedAt).getTime();
      }

      if (result === 0) {
        result = first.clientName.localeCompare(second.clientName);
      }

      return sortDirection === "ASC" ? result : result * -1;
    });

    return nextJobs;
  }, [
    viewJobs,
    searchTerm,
    sortDirection,
    sortKey,
  ]);

  function handleSort(nextSortKey: typeof sortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) =>
        current === "ASC" ? "DESC" : "ASC",
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "updated" ? "DESC" : "ASC");
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
      sections={[
        { id: "jobs-filters", label: "Filters" },
        { id: "jobs-list", label: "Jobs" },
      ]}
    >
      <div className="page">
        <div className="admin-page clients-page workspace-canonical-page">
          <WorkspaceHero
            eyebrow="Job Directory"
            title={
              scopedClientId
                ? `${scopedClientLabel} Jobs`
                : "Jobs"
            }
            description={
              scopedClientId
                ? `Jobs belonging to ${scopedClientLabel}.`
                : "Type anything you remember — client, job, or service address. Open the record when you find it."
            }
            metrics={
              state.status === "ready"
                ? [
                    { label: "Active", value: activeJobCount },
                    { label: "Archived", value: archivedJobCount },
                    { label: "Total", value: scopedJobs.length },
                  ]
                : []
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
                  to={`/app/jobs?clientId=${encodeURIComponent(
                    scopedClientId,
                  )}`}
                >
                  This Client
                </Link>

                <Link className="btn" to="/app/jobs">
                  All Jobs
                </Link>

                <Link
                  className="btn"
                  to={`/app/clients/${scopedClientId}`}
                >
                  Client Record
                </Link>
              </div>
            </nav>
          )}

          <section className="clients-directory-shell" id="jobs-list">
            <div className="clients-directory-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2>
                  {jobStatusFilter === "ALL"
                    ? "All jobs"
                    : `${formatLabel(jobStatusFilter)} jobs`}
                </h2>
              </div>
            </div>

            <div className="clients-findbar">
              <label className="clients-search">
                <span className="clients-search-kicker">Find a job</span>
                <span className="clients-search-control">
                  <input
                    aria-label="Search jobs"
                    placeholder="Type a client, job, or service address…"
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && searchTerm) {
                        event.preventDefault();
                        setSearchTerm("");
                      }
                    }}
                  />
                  {searchTerm && (
                    <button
                      className="clients-search-clear"
                      type="button"
                      onClick={() => setSearchTerm("")}
                    >
                      Clear ×
                    </button>
                  )}
                </span>
              </label>

              <Link
                className="btn btn-primary clients-findbar-add"
                to="/app/inbox"
              >
                + New Request
              </Link>
            </div>

            <div className="clients-directory-tools" id="jobs-filters">
              <div className="clients-view-control" aria-label="Job view">
                <span className="clients-tool-label">View</span>
                <div
                  className="admin-filter-tabs clients-filter-tabs"
                  aria-label="Job status filter"
                >
                  {[
                    ["ACTIVE", "Active", activeJobCount],
                    ["COMPLETED", "Completed", completedJobCount],
                    ["CANCELLED", "Cancelled", cancelledJobCount],
                    ["ARCHIVED", "Archived", archivedJobCount],
                    ["ALL", "All", scopedJobs.length],
                  ].map(([value, label, count]) => (
                    <button
                      aria-pressed={jobStatusFilter === value}
                      className={
                        jobStatusFilter === value
                          ? "is-active"
                          : undefined
                      }
                      key={value}
                      type="button"
                      onClick={() => {
                        setJobStatusFilter(
                          value as
                            | "ACTIVE"
                            | "COMPLETED"
                            | "CANCELLED"
                            | "ARCHIVED"
                            | "ALL",
                        );
                      }}
                    >
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="clients-most-recent"
                type="button"
                onClick={() => {
                  setSortKey("updated");
                  setSortDirection("DESC");
                }}
              >
                Most recent first
                <span aria-hidden="true">↓</span>
              </button>
            </div>

            {state.status === "loading" && (
              <section className="clients-message">
                Loading Jobs…
              </section>
            )}

            {state.status === "error" && (
              <section className="clients-message clients-message-error" role="alert">
                {state.message}
              </section>
            )}

            {state.status === "ready" && (
              <div className="clients-directory-content">
                <div className="clients-directory-count">
                  <span>
                    {visibleJobs.length} {jobStatusFilter.toLowerCase()} job{visibleJobs.length === 1 ? "" : "s"}
                  </span>
                  <span>
                    {searchTerm.trim()
                      ? `matching “${searchTerm.trim()}”`
                      : sortKey === "updated" && sortDirection === "DESC"
                        ? "Most recently updated first"
                        : "Click a column heading to sort"}
                  </span>
                </div>

                {visibleJobs.length === 0 ? (
                  <div className="clients-empty">
                    No Jobs match this view.
                  </div>
                ) : (
                  <>
                    <div className="clients-directory-columns">
                      <button
                        className={sortKey === "client" ? "is-active" : undefined}
                        type="button"
                        onClick={() => handleSort("client")}
                      >
                        Client{getSortLabel("client")}
                      </button>
                      <button
                        className={sortKey === "job" ? "is-active" : undefined}
                        type="button"
                        onClick={() => handleSort("job")}
                      >
                        Job{getSortLabel("job")}
                      </button>
                      <button
                        className={sortKey === "address" ? "is-active" : undefined}
                        type="button"
                        onClick={() => handleSort("address")}
                      >
                        Service property{getSortLabel("address")}
                      </button>
                      <button
                        className={sortKey === "updated" ? "is-active" : undefined}
                        type="button"
                        onClick={() => handleSort("updated")}
                      >
                        Updated{getSortLabel("updated")}
                      </button>
                      <span />
                    </div>

                    <div className="clients-directory-grid">
                      {visibleJobs.map((job) => {
                        const address = formatAddress(job);
                        const displayStatus = getJobDisplayStatus(job);

                        return (
                          <Link
                            className="client-directory-card"
                            key={job.id}
                            to={`/app/jobs/${job.id}`}
                          >
                            <div className="client-directory-identity">
                              <strong>{job.clientName}</strong>
                            </div>

                            <div className="client-directory-contact">
                              <strong>{job.title}</strong>
                              <span>
                                {formatLabel(displayStatus)} · Cycle {job.currentCycle.cycleNumber}
                              </span>
                            </div>

                            <div className="client-directory-property">
                              <strong>{address ?? "No service property"}</strong>
                            </div>

                            <div className="client-directory-updated">
                              <span>Updated</span>
                              <strong>{formatJourneyDate(job.updatedAt)}</strong>
                            </div>

                            <span className="client-directory-open">Open →</span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
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
  const [vowsState, setVowsState] = useState<
    | { status: "loading" }
    | { status: "ready"; vows: Vow[] }
    | { status: "error"; message: string }
  >({ status: "loading" });


  const [journeyState, setJourneyState] = useState<
    | { status: "loading" }
    | { status: "ready"; events: JobJourneyEvent[] }
    | { status: "error"; message: string }
  >({ status: "loading" });

  const [journeyExpanded, setJourneyExpanded] = useState(false);

  const [selectedJourneyEvent, setSelectedJourneyEvent] =
    useState<JobJourneyEvent | null>(null);

  const [journeySummaryState, setJourneySummaryState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; summary: string; model: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const [journeySummaryModalOpen, setJourneySummaryModalOpen] =
    useState(false);

  const [
    storedJourneySummaryState,
    setStoredJourneySummaryState,
  ] = useState<
    | { status: "loading" }
    | {
        status: "ready";
        summary: PersistedJourneySummary | null;
        stale: boolean;
      }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetchVows(controller.signal, job.id)
      .then((vows) => {
        setVowsState({ status: "ready", vows });
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setVowsState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load this Job’s VOWs.",
        });
      });

    return () => controller.abort();
  }, [job.id]);

  useEffect(() => {
    const controller = new AbortController();

    fetchJobJourney(job.id, controller.signal)
      .then((events) => {
        setJourneyState({ status: "ready", events });
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setJourneyState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load this Job’s journey.",
        });
      });

    return () => controller.abort();
  }, [job.id]);


  useEffect(() => {
    const controller = new AbortController();

    fetchJobJourneySummary(job.id, controller.signal)
      .then((result) => {
        setStoredJourneySummaryState({
          status: "ready",
          summary: result.summary,
          stale: result.stale,
        });
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setStoredJourneySummaryState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the saved Journey summary.",
        });
      });

    return () => controller.abort();
  }, [job.id]);



  const address = formatAddress(job);
  const stageClass =
    `admin-status-chip project-status-${job.currentCycle.stage.toLowerCase()}`;

  const isArchived = job.archivedAt !== null;
  const isCancelled =
    job.lifecycleStatus === "cancelled";

  const canOpenField =
    !isArchived &&
    !isCancelled &&
    job.currentCycle.stage === "open";

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

  async function handleJourneySummary(): Promise<void> {
    if (journeySummaryState.status === "loading") {
      return;
    }

    setJourneySummaryModalOpen(true);
    setJourneySummaryState({ status: "loading" });

    try {
      const result = await summarizeJobJourney(job.id);

      setJourneySummaryState({
        status: "ready",
        summary: result.summary,
        model: result.model,
      });

      setStoredJourneySummaryState({
        status: "ready",
        summary: {
          summary: result.summary,
          model: result.model,
          eventCount: result.eventCount,
          latestEventAt: result.latestEventAt,
          generatedAt: result.generatedAt,
        },
        stale: false,
      });
    } catch (error: unknown) {
      setJourneySummaryState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate the Journey summary.",
      });
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
            <Link className="btn" to="/app/jobs">
              ← Jobs
            </Link>

            {canOpenField && (
              <Link
                className="btn btn-primary"
                to="/app/field"
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
              Job:{" "}
              {isArchived
                ? "Archived"
                : isCancelled
                  ? "Cancelled"
                  : "Active"}
            </span>
            <span>
              Cycle {job.currentCycle.cycleNumber}
              {" · "}
              {job.currentCycle.stage === "completed"
                ? "Completed"
                : "Open"}
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
            <p className="eyebrow">Visual of Work</p>
            <h2>VOW Snapshots</h2>
          </div>

          <Link className="btn" to="/app/vows">
            VOW Library
          </Link>
        </div>

        {vowsState.status === "loading" && (
          <div className="notice">Loading VOWs…</div>
        )}

        {vowsState.status === "error" && (
          <div className="notice notice-error" role="alert">
            {vowsState.message}
          </div>
        )}

        {vowsState.status === "ready" &&
          vowsState.vows.length === 0 && (
            <div className="card-drawer">
              No VOW has been generated for this Job yet.
            </div>
          )}

        {vowsState.status === "ready" &&
          vowsState.vows.length > 0 && (
            <div className="cluster">
              {vowsState.vows.map((vow) => (
                <Link
                  className="btn btn-primary"
                  key={vow.id}
                  to={`/app/vows/${vow.id}`}
                >
                  View Cycle {vow.snapshot.cycle.cycleNumber} VOW
                </Link>
              ))}
            </div>
          )}
      </section>

      <section className="helper-card stack-lg">
        <div className="card-topline journey-topline">
          <div className="stack">
            <p className="eyebrow">Job History</p>
            <h2>Journey</h2>
          </div>

          <div className="cluster">
            {journeyState.status === "ready" && (
              <span className="vow-count">
                {journeyState.events.length}
              </span>
            )}

            {journeyState.status === "ready" &&
              journeyState.events.length > 0 && (
                <>
                  <button
                    className="btn"
                    type="button"
                    disabled={
                      journeySummaryState.status === "loading"
                    }
                    onClick={handleJourneySummary}
                  >
                    {journeySummaryState.status === "loading"
                      ? "Summarizing…"
                      : storedJourneySummaryState.status === "ready" &&
                          storedJourneySummaryState.summary
                        ? "Refresh Summary"
                        : "AI Summary"}
                  </button>

                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setJourneyExpanded((expanded) => !expanded)
                    }
                    aria-expanded={journeyExpanded}
                  >
                    {journeyExpanded ? "Collapse" : "Expand"}
                  </button>
                </>
              )}
          </div>
        </div>

        {storedJourneySummaryState.status === "ready" &&
          storedJourneySummaryState.summary && (
            <div className="journey-saved-summary">
              <div className="journey-saved-summary-heading">
                <div>
                  <p className="eyebrow">AI Work Summary</p>
                  <small>
                    Generated{" "}
                    {formatJourneyDate(
                      storedJourneySummaryState.summary.generatedAt,
                    )}
                  </small>
                </div>

                {storedJourneySummaryState.stale && (
                  <span className="admin-status-chip">
                    Update available
                  </span>
                )}
              </div>

              <div className="journey-saved-summary-copy">
                {storedJourneySummaryState.summary.summary}
              </div>

              <small>
                Local model:{" "}
                {storedJourneySummaryState.summary.model}
              </small>
            </div>
          )}

        {storedJourneySummaryState.status === "error" && (
          <div className="notice notice-error" role="alert">
            {storedJourneySummaryState.message}
          </div>
        )}

        {journeyState.status === "loading" && (
          <div className="notice">Loading Journey…</div>
        )}

        {journeyState.status === "error" && (
          <div className="notice notice-error" role="alert">
            {journeyState.message}
          </div>
        )}

        {journeyState.status === "ready" &&
          journeyState.events.length === 0 && (
            <div className="card-drawer">
              No Journey events have been recorded yet.
            </div>
          )}

        {journeyState.status === "ready" &&
          journeyState.events.length > 0 &&
          !journeyExpanded && (
            <div className="journey-collapsed-note">
              {journeyState.events.length} recorded steps. Expand
              the Journey to review individual events.
            </div>
          )}

        {journeyState.status === "ready" &&
          journeyState.events.length > 0 &&
          journeyExpanded && (
            <div className="job-journey">
              {journeyState.events.map((event, index) => (
                <button
                  className="job-journey-event"
                  type="button"
                  key={event.id}
                  onClick={() => setSelectedJourneyEvent(event)}
                >
                  <span className="job-journey-marker">
                    <span>{index + 1}</span>
                  </span>

                  <span className="job-journey-content">
                    <strong>
                      {formatLabel(event.eventType)}
                    </strong>
                    <small>
                      {formatJourneyDate(event.createdAt)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

        {selectedJourneyEvent && (
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) {
                setSelectedJourneyEvent(null);
              }
            }}
          >
            <section
              className="journey-detail-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="journey-detail-title"
            >
              <div className="journey-detail-heading">
                <div>
                  <p className="eyebrow">Journey Step</p>
                  <h2 id="journey-detail-title">
                    {formatLabel(
                      selectedJourneyEvent.eventType,
                    )}
                  </h2>
                  <p>
                    {formatJourneyDate(
                      selectedJourneyEvent.createdAt,
                    )}
                  </p>
                </div>

                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    setSelectedJourneyEvent(null)
                  }
                >
                  Close
                </button>
              </div>

              {(() => {
                const details = selectedJourneyEvent.details;
                const fieldNote = asJourneyRecord(
                  details.fieldNote,
                );
                const photo = asJourneyRecord(details.photo);
                const visit = asJourneyRecord(details.visit);
                const scopeRevision = asJourneyRecord(
                  details.scopeRevision,
                );
                const closure = asJourneyRecord(
                  details.closure,
                );
                const vow = asJourneyRecord(details.vow);

                const photoUrl = journeyText(photo, "url");
                const vowId = journeyText(details, "vowId");

                const supplemental = Object.entries(details)
                  .filter(([key, value]) => {
                    const normalized = key.toLowerCase();

                    return (
                      !normalized.endsWith("id") &&
                      !normalized.endsWith("ids") &&
                      (typeof value === "string" ||
                        typeof value === "number" ||
                        typeof value === "boolean")
                    );
                  });

                return (
                  <div className="journey-detail-body">
                    {fieldNote && (
                      <section className="journey-detail-section">
                        <p className="eyebrow">Field Note</p>
                        <p>
                          {journeyText(fieldNote, "content")}
                        </p>
                        {journeyText(
                          fieldNote,
                          "capturedAt",
                        ) && (
                          <small>
                            Captured{" "}
                            {formatJourneyDate(
                              journeyText(
                                fieldNote,
                                "capturedAt",
                              ),
                            )}
                          </small>
                        )}
                      </section>
                    )}

                    {photo && (
                      <section className="journey-detail-section">
                        <p className="eyebrow">Photo</p>

                        {photoUrl && (
                          <img
                            className="journey-detail-photo"
                            src={photoUrl}
                            alt={
                              journeyText(photo, "caption") ??
                              "Job photo"
                            }
                          />
                        )}

                        {journeyText(photo, "caption") && (
                          <p>
                            {journeyText(photo, "caption")}
                          </p>
                        )}

                        {journeyText(photo, "stage") && (
                          <small>
                            {formatLabel(
                              journeyText(photo, "stage")!,
                            )}
                          </small>
                        )}
                      </section>
                    )}

                    {visit && (
                      <section className="journey-detail-section">
                        <p className="eyebrow">Visit</p>

                        {journeyText(visit, "status") && (
                          <p>
                            Status:{" "}
                            <strong>
                              {formatLabel(
                                journeyText(
                                  visit,
                                  "status",
                                )!,
                              )}
                            </strong>
                          </p>
                        )}

                        {journeyText(
                          visit,
                          "scheduledStart",
                        ) && (
                          <p>
                            Scheduled:{" "}
                            {formatJourneyDate(
                              journeyText(
                                visit,
                                "scheduledStart",
                              ),
                            )}
                          </p>
                        )}

                        {journeyText(visit, "notes") && (
                          <p>{journeyText(visit, "notes")}</p>
                        )}
                      </section>
                    )}

                    {scopeRevision && (
                      <section className="journey-detail-section">
                        <p className="eyebrow">
                          Scope Revision
                        </p>

                        {journeyValue(
                          scopeRevision,
                          "revisionNumber",
                        ) && (
                          <h3>
                            Revision{" "}
                            {journeyValue(
                              scopeRevision,
                              "revisionNumber",
                            )}
                          </h3>
                        )}

                        {journeyText(
                          scopeRevision,
                          "scopeText",
                        ) && (
                          <p>
                            {journeyText(
                              scopeRevision,
                              "scopeText",
                            )}
                          </p>
                        )}

                        {journeyValue(
                          scopeRevision,
                          "priceChange",
                        ) && (
                          <p>
                            Price change: $
                            {journeyValue(
                              scopeRevision,
                              "priceChange",
                            )}
                          </p>
                        )}

                        {journeyText(
                          scopeRevision,
                          "reason",
                        ) && (
                          <p>
                            {journeyText(
                              scopeRevision,
                              "reason",
                            )}
                          </p>
                        )}
                      </section>
                    )}

                    {closure && (
                      <section className="journey-detail-section">
                        <p className="eyebrow">Completion</p>

                        {journeyValue(
                          closure,
                          "finalPrice",
                        ) && (
                          <p>
                            Final price: $
                            {journeyValue(
                              closure,
                              "finalPrice",
                            )}
                          </p>
                        )}

                        {journeyText(
                          closure,
                          "completionDate",
                        ) && (
                          <p>
                            Completed:{" "}
                            {formatJourneyDate(
                              journeyText(
                                closure,
                                "completionDate",
                              ),
                            )}
                          </p>
                        )}

                        {journeyText(closure, "notes") && (
                          <p>
                            {journeyText(
                              closure,
                              "notes",
                            )}
                          </p>
                        )}
                      </section>
                    )}

                    {vow && (
                      <section className="journey-detail-section">
                        <p className="eyebrow">VOW</p>
                        <p>
                          {journeyText(vow, "title") ??
                            "Visual of Work"}
                        </p>

                        {vowId && (
                          <Link
                            className="btn"
                            to={`/app/vows/${vowId}`}
                          >
                            Open VOW
                          </Link>
                        )}
                      </section>
                    )}

                    {supplemental.length > 0 && (
                      <dl className="journey-detail-meta">
                        {supplemental.map(([key, value]) => (
                          <div key={key}>
                            <dt>{formatLabel(key)}</dt>
                            <dd>{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {journeySummaryModalOpen &&
          journeySummaryState.status !== "idle" && (
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) {
                setJourneySummaryModalOpen(false);
              }
            }}
          >
            <section
              className="journey-detail-panel journey-summary-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="journey-summary-title"
            >
              <div className="journey-detail-heading">
                <div>
                  <p className="eyebrow">Local AI</p>
                  <h2 id="journey-summary-title">
                    Journey Summary
                  </h2>
                </div>

                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    setJourneySummaryModalOpen(false)
                  }
                >
                  Close
                </button>
              </div>

              {journeySummaryState.status === "loading" && (
                <div className="notice">
                  Summarizing Journey locally…
                </div>
              )}

              {journeySummaryState.status === "error" && (
                <div
                  className="notice notice-error"
                  role="alert"
                >
                  {journeySummaryState.message}
                </div>
              )}

              {journeySummaryState.status === "ready" && (
                <div className="journey-ai-summary">
                  <div>
                    {journeySummaryState.summary}
                  </div>
                  <small>
                    Local model:{" "}
                    {journeySummaryState.model}
                  </small>
                </div>
              )}
            </section>
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
            {job.currentCycle.stage === "completed"
              ? "Completed"
              : "Open"}
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

export function ArchivedJobDetailPage() {
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
                <Link className="btn" to="/app/jobs">
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
              key={state.job.id}
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
            <Link className="btn btn-primary" to="/app/inbox">
              Return to Inbox
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function DemoHub() {
  const [mode, setMode] = useState<"tour" | "guide">("tour");

  return (
    <DemoProvider>
      {mode === "tour" ? (
        <Eli5Page onGuidedWalkthrough={() => setMode("guide")} />
      ) : (
        <DemoPage onTour={() => setMode("tour")} />
      )}
    </DemoProvider>
  );
}

function AppEntryPage() {
  const location = useLocation();

  // Bare /app is the device-aware product entry. Query-string actions are
  // explicit Site Mode actions (for example /app?compose=request).
  if (location.search) {
    return <InboxPage />;
  }

  return shouldDefaultToFieldMode() ? (
    <Navigate to="/app/field" replace />
  ) : (
    <InboxPage />
  );
}

function App() {
  const location = useLocation();
  const isAppSurface =
    location.pathname === "/app" ||
    location.pathname.startsWith("/app/");

  return (
    <div className={isAppSurface ? "vizow-app-surface" : undefined}>
      <Routes>
      <Route path="/" element={<Navigate to="/demo" replace />} />

      <Route path="/demo" element={<DemoHub />} />
      <Route path="/demo/guide" element={<Navigate to="/demo" replace />} />
      <Route path="/demo/eli5" element={<Navigate to="/demo" replace />} />
      <Route path="/demo/walkthrough" element={<Navigate to="/demo" replace />} />
      <Route path="/eli5" element={<Navigate to="/demo" replace />} />

      <Route path="/app" element={<AppEntryPage />} />
      <Route path="/app/inbox" element={<InboxPage />} />
      <Route path="/app/today" element={<Today />} />
      <Route path="/app/nailed-it" element={<NailedItPage />} />
      <Route path="/app/calendar" element={<CalendarPage />} />
      <Route path="/app/media" element={<MediaLibraryPage />} />
      <Route path="/app/reporting" element={<ReportingPage />} />
      <Route path="/app/data" element={<BusinessDataPage />} />
      <Route path="/app/field" element={<FieldModePage />} />
      <Route path="/app/jobs" element={<JobsPage />} />
      <Route path="/app/jobs/:jobId" element={<JobPage />} />
      <Route path="/app/jobs/:jobId/vow" element={<JobVowPage />} />
      <Route path="/app/vows" element={<VowsPage />} />
      <Route path="/app/vows/:vowId" element={<VowDetailPage />} />
      <Route path="/app/clients" element={<ClientsPage />} />
      <Route path="/app/clients/:clientId" element={<ClientDetailPage />} />

      <Route path="/request" element={<PublicRequestPage />} />
      <Route path="/availability" element={<PublicCalendarPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;
