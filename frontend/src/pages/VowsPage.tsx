import type { Job, Vow } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";

import { fetchJobs } from "../api/jobs";
import { fetchVow } from "../api/vows";
import { WorkspaceHero } from "../components/WorkspaceHero";
import { AppLayout } from "../layouts/AppLayout";

type VowsState =
  | { status: "loading" }
  | { status: "ready"; jobs: Job[] }
  | { status: "error"; message: string };

type LegacyVowState =
  | { status: "loading" }
  | { status: "ready"; vow: Vow }
  | { status: "error"; message: string };

type VowView = "all" | "active" | "completed" | "cancelled" | "archived";
type VowSortKey = "client" | "job" | "property" | "updated";
type SortDirection = "asc" | "desc";

function formatAddress(job: Job): string {
  return [
    [job.serviceAddressLine1, job.serviceAddressLine2].filter(Boolean).join(", "),
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

function statusKey(job: Job): VowView {
  return jobStatus(job).toLowerCase() as VowView;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function VowsPage() {
  const [state, setState] = useState<VowsState>({ status: "loading" });
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<VowView>("all");
  const [sortKey, setSortKey] = useState<VowSortKey>("updated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    const controller = new AbortController();

    fetchJobs(controller.signal, true)
      .then((jobs) => setState({ status: "ready", jobs }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to load Visuals of Work.",
        });
      });

    return () => controller.abort();
  }, []);

  const jobs = state.status === "ready" ? state.jobs : [];
  const counts = useMemo(() => {
    const next = { active: 0, completed: 0, cancelled: 0, archived: 0 };
    for (const job of jobs) {
      const key = statusKey(job);
      if (key !== "all") next[key] += 1;
    }
    return next;
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matches = jobs.filter((job) => {
      if (view !== "all" && statusKey(job) !== view) return false;
      if (!query) return true;

      return [job.title, job.clientName, formatAddress(job), jobStatus(job)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return [...matches].sort((first, second) => {
      let comparison = 0;
      if (sortKey === "client") comparison = first.clientName.localeCompare(second.clientName);
      else if (sortKey === "job") comparison = first.title.localeCompare(second.title);
      else if (sortKey === "property") comparison = formatAddress(first).localeCompare(formatAddress(second));
      else comparison = new Date(first.updatedAt).getTime() - new Date(second.updatedAt).getTime();

      if (comparison === 0) comparison = first.title.localeCompare(second.title);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [jobs, searchTerm, sortDirection, sortKey, view]);

  function changeSort(nextKey: VowSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "updated" ? "desc" : "asc");
  }

  function sortArrow(key: VowSortKey) {
    if (key !== sortKey) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  const viewLabel = view === "all" ? "All visual records" : `${view[0].toUpperCase()}${view.slice(1)} visual records`;

  return (
    <AppLayout
      object="Visuals of Work"
      tool="VOW"
      action="Open Job VOW"
      result={
        state.status === "ready"
          ? `${jobs.length} available`
          : state.status === "error"
            ? "Not loaded"
            : "Loading"
      }
      message="One living Visual of Work per Job. Output views are created from the full VOW."
      activeStep="action"
      resultTone={state.status === "error" ? "error" : "success"}
      sections={[{ id: "vow-library", label: "VOWs" }]}
    >
      <div className="page">
        <div className="shell workspace-canonical-page vow-library-page">
          <WorkspaceHero
            eyebrow="Visual of Work"
            title="VOWs"
            description="Find the living visual record for any Job. One Job, one VOW, updated as the work changes."
            metrics={
              state.status === "ready"
                ? [
                    { label: "Active", value: counts.active },
                    { label: "Completed", value: counts.completed },
                    { label: "Total", value: jobs.length },
                  ]
                : []
            }
          />

          <section className="vow-directory-shell" id="vow-library">
            <header className="vow-directory-heading">
              <div>
                <p className="workspace-eyebrow">Library</p>
                <h2>{viewLabel}</h2>
              </div>
              <strong>{visibleJobs.length} shown</strong>
            </header>

            <div className="vow-findbar">
              <label className="vow-search">
                <span className="vow-search-kicker">Find a VOW</span>
                <span className="vow-search-control">
                  <input
                    aria-label="Search Visuals of Work"
                    placeholder="Type a client, Job, service address, or status…"
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && searchTerm) {
                        event.preventDefault();
                        setSearchTerm("");
                      }
                    }}
                  />
                  {searchTerm ? (
                    <button className="vow-search-clear" type="button" onClick={() => setSearchTerm("")}>
                      Clear ×
                    </button>
                  ) : null}
                </span>
              </label>
            </div>

            <div className="vow-directory-tools">
              <div className="vow-view-control" aria-label="VOW view">
                <span className="vow-tool-label">View</span>
                <div className="vow-filter-tabs" aria-label="Visual record status filter">
                  {([
                    ["all", "All", jobs.length],
                    ["active", "Active", counts.active],
                    ["completed", "Completed", counts.completed],
                    ["cancelled", "Cancelled", counts.cancelled],
                    ["archived", "Archived", counts.archived],
                  ] as const).map(([key, label, count]) => (
                    <button
                      key={key}
                      aria-pressed={view === key}
                      className={view === key ? "is-active" : undefined}
                      type="button"
                      onClick={() => setView(key)}
                    >
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="vow-most-recent"
                type="button"
                onClick={() => {
                  setSortKey("updated");
                  setSortDirection("desc");
                }}
              >
                Most recent first <span aria-hidden="true">↓</span>
              </button>
            </div>

            <div className="vow-directory-content">
              {state.status === "loading" && <div className="notice">Loading Visuals of Work…</div>}
              {state.status === "error" && <div className="notice notice-error" role="alert">{state.message}</div>}

              {state.status === "ready" && (
                <>
                  <div className="vow-directory-count">
                    <span>{visibleJobs.length} visual record{visibleJobs.length === 1 ? "" : "s"}</span>
                    <span>
                      {searchTerm.trim()
                        ? `matching “${searchTerm.trim()}”`
                        : sortKey === "updated" && sortDirection === "desc"
                          ? "Most recently updated first"
                          : "Click a column heading to sort"}
                    </span>
                  </div>

                  {visibleJobs.length === 0 ? (
                    <div className="vow-empty">
                      <strong>No VOWs match this view.</strong>
                      <span>Clear the search or change the View filter.</span>
                    </div>
                  ) : (
                    <>
                      <div className="vow-directory-columns">
                        <button type="button" className={sortKey === "client" ? "is-active" : undefined} onClick={() => changeSort("client")}>
                          Client{sortArrow("client")}
                        </button>
                        <button type="button" className={sortKey === "job" ? "is-active" : undefined} onClick={() => changeSort("job")}>
                          Job{sortArrow("job")}
                        </button>
                        <button type="button" className={sortKey === "property" ? "is-active" : undefined} onClick={() => changeSort("property")}>
                          Service property{sortArrow("property")}
                        </button>
                        <button type="button" className={sortKey === "updated" ? "is-active" : undefined} onClick={() => changeSort("updated")}>
                          Updated{sortArrow("updated")}
                        </button>
                        <span />
                      </div>

                      <div className="vow-directory-grid">
                        {visibleJobs.map((job) => (
                          <Link className="vow-directory-row" key={job.id} to={`/app/jobs/${job.id}/vow`}>
                            <div className="vow-directory-client">
                              <strong>{job.clientName}</strong>
                            </div>

                            <div className="vow-directory-job">
                              <strong>{job.title}</strong>
                              <span>{jobStatus(job)} · Cycle {job.currentCycle.cycleNumber}</span>
                            </div>

                            <div className="vow-directory-property">
                              <strong>{formatAddress(job)}</strong>
                            </div>

                            <div className="vow-directory-updated">
                              <span>Updated</span>
                              <strong>{formatDate(job.updatedAt)}</strong>
                            </div>

                            <span className="vow-directory-open">Open VOW →</span>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

export function VowDetailPage() {
  const { vowId } = useParams<{ vowId: string }>();
  const [state, setState] = useState<LegacyVowState>(
    vowId ? { status: "loading" } : { status: "error", message: "The VOW ID is missing." },
  );

  useEffect(() => {
    if (!vowId) return;
    const controller = new AbortController();

    fetchVow(vowId, controller.signal)
      .then((vow) => setState({ status: "ready", vow }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to resolve this VOW.",
        });
      });

    return () => controller.abort();
  }, [vowId]);

  if (state.status === "ready") {
    return <Navigate replace to={`/app/jobs/${state.vow.snapshot.job.id}/vow`} />;
  }

  return (
    <AppLayout
      object="Visual of Work"
      tool="VOW"
      action="Open current VOW"
      result={state.status === "error" ? "Not loaded" : "Loading"}
      message="Resolving this older VOW link to the Job's living Visual of Work."
      activeStep="result"
      resultTone={state.status === "error" ? "error" : "working"}
    >
      <div className="page">
        <div className={state.status === "error" ? "notice notice-error" : "notice"}>
          {state.status === "error" ? state.message : "Opening Visual of Work…"}
        </div>
      </div>
    </AppLayout>
  );
}
