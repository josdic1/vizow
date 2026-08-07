import type { Vow } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { fetchVow, fetchVows } from "../api/vows";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AppLayout } from "../layouts/AppLayout";

type VowsState =
  | { status: "loading" }
  | { status: "ready"; vows: Vow[] }
  | { status: "error"; message: string };

type VowState =
  | { status: "loading" }
  | { status: "ready"; vow: Vow }
  | { status: "error"; message: string };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAddress(vow: Vow): string {
  const { job } = vow.snapshot;
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

export function VowsPage() {
  const [state, setState] = useState<VowsState>({
    status: "loading",
  });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetchVows(controller.signal)
      .then((vows) => {
        setState({ status: "ready", vows });
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load VOWs.",
        });
      });

    return () => controller.abort();
  }, []);

  const vows = useMemo(
    () => (state.status === "ready" ? state.vows : []),
    [state],
  );
  const visibleVows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return vows;
    }

    return vows.filter((vow) =>
      [
        vow.title,
        vow.snapshot.client.name,
        formatAddress(vow),
        vow.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchTerm, vows]);

  return (
    <AppLayout
      object="Visuals of Work"
      tool="VOW"
      action="Review snapshots"
      result={
        state.status === "ready"
          ? `${vows.length} available`
          : state.status === "error"
            ? "Not loaded"
            : "Loading"
      }
      message="Generated VOW snapshots remain attached to their original Job cycles."
      activeStep="action"
      resultTone={state.status === "error" ? "error" : "success"}
    >
      <div className="page">
        <div className="admin-page">
          <AdminPageHeader
            eyebrow="Visual of Work"
            title="VOW Library"
            description="Open the permanent snapshot generated from a completed Job cycle."
            meta={<span>{vows.length} VOWs</span>}
          />

          <div className="admin-toolbar">
            <label className="admin-search-field">
              <span className="sr-only">Search VOWs</span>
              <input
                placeholder="Client, Job, address…"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.currentTarget.value);
                }}
              />
            </label>
          </div>

          {state.status === "loading" && (
            <div className="notice">Loading VOWs…</div>
          )}

          {state.status === "error" && (
            <div className="notice notice-error" role="alert">
              {state.message}
            </div>
          )}

          {state.status === "ready" && visibleVows.length === 0 && (
            <div className="admin-empty-state admin-empty-state-large">
              <strong>No VOWs match this view.</strong>
              <span>
                Generate a VOW from a completed work cycle or clear the search.
              </span>
            </div>
          )}

          {visibleVows.length > 0 && (
            <div className="vow-card-grid">
              {visibleVows.map((vow) => (
                <article className="vow-card" key={vow.id}>
                  <div className="card-topline">
                    <div>
                      <p className="eyebrow">
                        {vow.snapshot.client.name}
                      </p>
                      <h2>{vow.snapshot.job.title}</h2>
                    </div>
                    <span className="admin-status-chip">
                      {vow.status}
                    </span>
                  </div>
                  <p>{formatAddress(vow)}</p>
                  <div className="vow-card-meta">
                    <span>Cycle {vow.snapshot.cycle.cycleNumber}</span>
                    <span>{formatDate(vow.createdAt)}</span>
                  </div>
                  <Link
                    className="btn btn-primary"
                    to={`/vows/${vow.id}`}
                  >
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
  const [state, setState] = useState<VowState>(() =>
    vowId
      ? { status: "loading" }
      : {
          status: "error",
          message: "The VOW ID is missing from the URL.",
        },
  );

  useEffect(() => {
    if (!vowId) {
      return;
    }

    const controller = new AbortController();

    fetchVow(vowId, controller.signal)
      .then((vow) => {
        setState({ status: "ready", vow });
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the VOW.",
        });
      });

    return () => controller.abort();
  }, [vowId]);

  const vow = state.status === "ready" ? state.vow : null;

  return (
    <AppLayout
      object={vow?.snapshot.job.title ?? "Selected VOW"}
      tool="VOW"
      action="Inspect snapshot"
      result={
        state.status === "ready"
          ? "Loaded"
          : state.status === "error"
            ? "Not loaded"
            : "Loading"
      }
      message="This page displays the immutable snapshot captured when the VOW was generated."
      activeStep="action"
      resultTone={state.status === "error" ? "error" : "success"}
    >
      <div className="page">
        <div className="admin-page vow-detail-page">
          {state.status === "loading" && (
            <div className="notice">Loading VOW…</div>
          )}

          {state.status === "error" && (
            <div className="notice notice-error" role="alert">
              {state.message}
            </div>
          )}

          {vow && (
            <>
              <AdminPageHeader
                eyebrow={vow.snapshot.client.name}
                title={vow.snapshot.job.title}
                description={formatAddress(vow)}
                actions={
                  <div className="cluster">
                    <Link className="btn" to="/vows">
                      ← VOW Library
                    </Link>
                    <Link
                      className="btn"
                      to={`/jobs/${vow.snapshot.job.id}`}
                    >
                      Open Job
                    </Link>
                  </div>
                }
                meta={
                  <>
                    <span>Cycle {vow.snapshot.cycle.cycleNumber}</span>
                    <span>{vow.status}</span>
                    <span>Created {formatDate(vow.createdAt)}</span>
                  </>
                }
              />

              <section className="helper-card stack-lg">
                <div className="card-topline">
                  <div>
                    <p className="eyebrow">Field Record</p>
                    <h2>Notes</h2>
                  </div>
                  <span className="vow-count">
                    {vow.snapshot.fieldNotes.length}
                  </span>
                </div>

                {vow.snapshot.fieldNotes.length === 0 ? (
                  <p>No field notes were captured in this snapshot.</p>
                ) : (
                  <div className="vow-note-list">
                    {vow.snapshot.fieldNotes.map((note) => (
                      <article key={note.id}>
                        <p>{note.content}</p>
                        <small>{formatDate(note.capturedAt)}</small>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="helper-card stack-lg">
                <div className="card-topline">
                  <div>
                    <p className="eyebrow">Media Record</p>
                    <h2>Photos</h2>
                  </div>
                  <span className="vow-count">
                    {vow.snapshot.media.length}
                  </span>
                </div>

                {vow.snapshot.media.length === 0 ? (
                  <p>No photos were captured in this snapshot.</p>
                ) : (
                  <div className="vow-media-grid">
                    {vow.snapshot.media.map((media) => (
                      <figure key={media.id}>
                        <img
                          src={media.url}
                          alt={media.caption ?? `${media.stage} work photo`}
                        />
                        <figcaption>
                          <strong>{media.stage}</strong>
                          {media.caption && <span>{media.caption}</span>}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
