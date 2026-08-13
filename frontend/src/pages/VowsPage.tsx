import type { Job, Vow } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";

import { fetchJobs } from "../api/jobs";
import { fetchVow } from "../api/vows";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AppLayout } from "../layouts/AppLayout";

type VowsState =
  | { status: "loading" }
  | { status: "ready"; jobs: Job[] }
  | { status: "error"; message: string };

type LegacyVowState =
  | { status: "loading" }
  | { status: "ready"; vow: Vow }
  | { status: "error"; message: string };

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

export function VowsPage() {
  const [state, setState] = useState<VowsState>({ status: "loading" });
  const [searchTerm, setSearchTerm] = useState("");

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
  const visibleJobs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return jobs;

    return jobs.filter((job) =>
      [job.title, job.clientName, formatAddress(job), jobStatus(job)]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [jobs, searchTerm]);

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
        <div className="admin-page">
          <AdminPageHeader
            eyebrow="Visual of Work"
            title="VOW Library"
            description="Open the complete visual record for any Job."
            meta={<span>{jobs.length} Jobs</span>}
          />

          <div className="admin-toolbar">
            <label className="admin-search-field">
              <span className="sr-only">Search Visuals of Work</span>
              <input
                placeholder="Client, Job, address…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
              />
            </label>
          </div>

          {state.status === "loading" && <div className="notice">Loading Visuals of Work…</div>}
          {state.status === "error" && <div className="notice notice-error" role="alert">{state.message}</div>}

          {state.status === "ready" && visibleJobs.length === 0 && (
            <div className="admin-empty-state admin-empty-state-large">
              <strong>No VOWs match this view.</strong>
              <span>Clear the search or create a Job.</span>
            </div>
          )}

          {visibleJobs.length > 0 && (
            <div className="vow-card-grid" id="vow-library">
              {visibleJobs.map((job) => (
                <article className="vow-card" key={job.id}>
                  <div className="card-topline">
                    <div>
                      <p className="eyebrow">{job.clientName}</p>
                      <h2>{job.title}</h2>
                    </div>
                    <span className="admin-status-chip">{jobStatus(job)}</span>
                  </div>
                  <p>{formatAddress(job)}</p>
                  <div className="vow-card-meta">
                    <span>Cycle {job.currentCycle.cycleNumber}</span>
                    <span>Updated {new Date(job.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <Link className="btn btn-primary" to={`/jobs/${job.id}/vow`}>
                    Open VOW
                  </Link>
                </article>
              ))}
            </div>
          )}
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
    return <Navigate replace to={`/jobs/${state.vow.snapshot.job.id}/vow`} />;
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
