import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { Client, Request as WorkRequest, ReviewRequestInput } from "@vizow/shared";

import { createClient, fetchClients } from "../api/clients";
import { approveRequest, declineRequest, fetchRequests, reviewRequest } from "../api/requests";
import { fetchDemoSessionStatus } from "../api/demoSession";
import { InternalRequestComposer } from "../components/InternalRequestComposer";
import { WorkspaceHero } from "../components/WorkspaceHero";
import "../styles/clients-workspace.css";
import { AppLayout } from "../layouts/AppLayout";

type PageState =
  | { status: "loading" }
  | { status: "ready"; requests: WorkRequest[]; clients: Client[] }
  | { status: "error"; message: string };

type Draft = ReviewRequestInput;
type InboxView = "new" | "history";

function requestAddress(request: WorkRequest): string {
  return [
    [request.serviceAddressLine1, request.serviceAddressLine2].filter(Boolean).join(", "),
    [request.serviceCity, request.serviceState, request.servicePostalCode].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function requestDraft(request: WorkRequest): Draft {
  return {
    // A suggested match is evidence, not a decision. Require an explicit choice.
    clientId: request.clientId ?? "",
    title: request.title,
    description: request.description,
    serviceAddressLine1: request.serviceAddressLine1,
    serviceAddressLine2: request.serviceAddressLine2,
    serviceCity: request.serviceCity,
    serviceState: request.serviceState,
    servicePostalCode: request.servicePostalCode,
  };
}

function inboxStatusLabel(request: WorkRequest): string {
  if (request.status === "open") return "New";
  if (request.status === "approved") return "Job created";
  return "Declined";
}

export function InboxPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<InboxView>("new");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"approve" | "decline" | "client" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [internalRequestOpen, setInternalRequestOpen] = useState(
    () => new URLSearchParams(location.search).get("compose") === "request",
  );
  const [jobComposerOpen, setJobComposerOpen] = useState(false);
  const [privateDemo, setPrivateDemo] = useState(false);
  const requestListRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const focusDetailOnOpenRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchDemoSessionStatus(controller.signal)
      .then((status) => setPrivateDemo(status.enabled && status.active))
      .catch(() => setPrivateDemo(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchRequests(controller.signal), fetchClients(controller.signal, true)])
      .then(([requests, clients]) => {
        setState({ status: "ready", requests, clients });
        setSelectedId(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load Inbox." });
      });
    return () => controller.abort();
  }, []);

  const requests = state.status === "ready" ? state.requests : [];
  const clients = state.status === "ready" ? state.clients.filter((client) => !client.archivedAt) : [];
  const selected = requests.find((request) => request.id === selectedId) ?? null;
  const openCount = requests.filter((request) => request.status === "open").length;
  const historyCount = requests.length - openCount;

  useEffect(() => {
    setDraft(selected ? requestDraft(selected) : null);
    setMessage(null);
    setClientPickerOpen(false);
    setJobComposerOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!focusDetailOnOpenRef.current || !selectedId || !draft) return;
    focusDetailOnOpenRef.current = false;
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedId, draft]);

  function openRequest(requestId: string) {
    focusDetailOnOpenRef.current = true;
    setSelectedId(requestId);
  }

  function returnToRequests() {
    setSelectedId(null);
    window.requestAnimationFrame(() => {
      requestListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const visibleRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests
      .filter((request) => {
        const belongsInView = view === "new"
          ? request.status === "open"
          : request.status !== "open";
        if (!belongsInView) return false;
        if (!needle) return true;
        return [request.submittedName, request.clientName, request.title, request.description, requestAddress(request)]
          .filter(Boolean).join(" ").toLowerCase().includes(needle);
      })
      .sort((first, second) =>
        new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime(),
      );
  }, [requests, search, view]);

  const draftClient = draft?.clientId
    ? clients.find((client) => client.id === draft.clientId) ?? null
    : null;
  const suggestedClient = selected?.suggestedClientId
    ? clients.find((client) => client.id === selected.suggestedClientId) ?? null
    : null;

  function changeView(nextView: InboxView): void {
    setView(nextView);
    setMessage(null);
    const next = requests.find((request) =>
      nextView === "new" ? request.status === "open" : request.status !== "open",
    );
    setSelectedId(next?.id ?? null);
  }

  function replaceRequest(next: WorkRequest): void {
    setState((current) => current.status === "ready"
      ? { ...current, requests: current.requests.map((request) => request.id === next.id ? next : request) }
      : current);
  }

  function updateDraft(field: keyof Draft, value: string): void {
    setDraft((current) => current ? { ...current, [field]: value || null } : current);
  }

  async function createClientFromRequest(): Promise<void> {
    if (!selected || state.status !== "ready") return;
    const name = selected.submittedName?.trim();
    if (!name) {
      setMessage("Create the Client from Clients, then select it here.");
      return;
    }

    setBusy("client");
    setMessage(null);
    try {
      const hasAddress = Boolean(selected.serviceAddressLine1 && selected.serviceCity && selected.serviceState && selected.servicePostalCode);
      const client = await createClient({
        name,
        email: selected.submittedEmail,
        phone: selected.submittedPhone,
        notes: null,
        defaultAddress: hasAddress ? {
          label: "Primary",
          addressLine1: selected.serviceAddressLine1!,
          addressLine2: selected.serviceAddressLine2,
          city: selected.serviceCity!,
          state: selected.serviceState!,
          postalCode: selected.servicePostalCode!,
        } : null,
      });
      setState((current) => current.status === "ready"
        ? { ...current, clients: [...current.clients, client].sort((a, b) => a.name.localeCompare(b.name)) }
        : current);
      updateDraft("clientId", client.id);
      setClientPickerOpen(false);
      setMessage(`${client.name} was created and selected.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create Client.");
    } finally {
      setBusy(null);
    }
  }

  async function approve(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || !draft || !draft.clientId || !draft.title.trim()) {
      setMessage("Choose the Client and confirm the work title.");
      return;
    }

    setBusy("approve");
    setMessage(null);
    try {
      const reviewed = await reviewRequest(selected.id, {
        ...draft,
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
      });
      replaceRequest(reviewed);
      const result = await approveRequest(selected.id);
      replaceRequest(result.request);
      navigate(`/app/jobs/${result.job.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create Job.");
    } finally {
      setBusy(null);
    }
  }

  async function decline(): Promise<void> {
    if (!selected) return;
    const reason = window.prompt("Why are you declining this work?");
    if (!reason?.trim()) return;
    setBusy("decline");
    setMessage(null);
    try {
      const next = await declineRequest(selected.id, { reason: reason.trim() });
      replaceRequest(next);
      setView("new");
      const nextOpen = requests.find((request) => request.id !== selected.id && request.status === "open");
      setSelectedId(nextOpen?.id ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to decline this work.");
    } finally {
      setBusy(null);
    }
  }


  return (
    <AppLayout
      work={
        internalRequestOpen
          ? "New Request"
          : selected?.title ??
            (state.status === "loading"
              ? "Loading Inbox"
              : openCount === 1
                ? "1 request waiting"
                : `${openCount} requests waiting`)
      }
      client={
        internalRequestOpen
          ? "Internal intake"
          : selected?.submittedName ?? selected?.clientName ?? "—"
      }
      status={
        internalRequestOpen
          ? "Request · Draft"
          : selected
            ? `Request · ${inboxStatusLabel(selected)}`
            : state.status === "error"
              ? "Inbox · Error"
              : "Inbox"
      }
      next={
        internalRequestOpen
          ? "Save to Inbox"
          : selected?.status === "open"
            ? jobComposerOpen ? "Create Job" : "Review request"
            : selected?.status === "approved"
              ? "Open Job"
              : selected?.status === "declined"
                ? "Review history"
                : openCount > 0
                  ? "Review newest"
                  : "Inbox clear"
      }
      sections={[{ id: "inbox-work", label: "Inbox" }]}
    >
      <div className="page requests-inbox-page inbox-clean-page">
        <div className="admin-page clients-page workspace-canonical-page inbox-clean-shell">
          {internalRequestOpen ? (
            <>
              <header className="inbox-clean-hero inbox-clean-hero-compose">
                <div>
                  <p className="eyebrow">Incoming Work</p>
                  <h1>New Request</h1>
                  <p>Log a phone call, text, or walk-in. Saving puts it in Inbox for review; it does not create a Job.</p>
                </div>
                <button className="btn" type="button" onClick={() => setInternalRequestOpen(false)}>
                  ← Back to Inbox
                </button>
              </header>

              {state.status === "loading" && <div className="notice">Loading Inbox…</div>}
              {state.status === "error" && <div className="notice notice-error">{state.message}</div>}

              {state.status === "ready" && (
                <section className="inbox-clean-compose" id="inbox-work">
                  <InternalRequestComposer
                    clients={clients}
                    onClose={() => setInternalRequestOpen(false)}
                    onCreated={(request, createdClient) => {
                      setState((current) => current.status === "ready"
                        ? {
                            ...current,
                            requests: [request, ...current.requests],
                            clients: createdClient
                              ? [...current.clients, createdClient].sort((a, b) => a.name.localeCompare(b.name))
                              : current.clients,
                          }
                        : current);
                      setView("new");
                      setSearch("");
                      setSelectedId(request.id);
                      setInternalRequestOpen(false);
                    }}
                  />
                </section>
              )}
            </>
          ) : (
            <>
              <WorkspaceHero
                eyebrow="Incoming Work"
                title="Inbox"
                description="Type anything you remember — client, work, or service address. A Request stays a Request until you decide to turn it into a Job."
                metrics={[
                  { label: "New", value: openCount },
                  { label: "History", value: historyCount },
                  { label: "Total", value: requests.length },
                ]}
              />

              {privateDemo && (
                <section className="inbox-demo-start" aria-label="Private demo starting point">
                  <div>
                    <span>PRIVATE DEMO · START HERE</span>
                    <strong>Two Requests are waiting. Open one and turn it into a Job.</strong>
                    <p>One is a brand-new Client. One already exists. Review the Request, confirm the Client, then Create Job.</p>
                  </div>
                  <Link to="/demo">GUIDED WALKTHROUGH →</Link>
                </section>
              )}

              {state.status === "loading" && <div className="notice">Loading Inbox…</div>}
              {state.status === "error" && <div className="notice notice-error">{state.message}</div>}

              {state.status === "ready" && (
                <div className="inbox-clean-workspace" id="inbox-work">
                  <section ref={requestListRef} className="clients-directory-shell" aria-label="Incoming requests">
                    <div className="clients-directory-heading">
                      <div>
                        <p className="eyebrow">Requests</p>
                        <h2>{view === "new" ? "New requests" : "Request history"}</h2>
                      </div>
                    </div>

                    <div className="clients-findbar">
                      <label className="clients-search">
                        <span className="clients-search-kicker">Find a request</span>
                        <span className="clients-search-control">
                          <input
                            aria-label="Search Inbox"
                            placeholder="Type a client, work item, or service address…"
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape" && search) {
                                event.preventDefault();
                                setSearch("");
                              }
                            }}
                          />
                          {search && (
                            <button
                              className="clients-search-clear"
                              type="button"
                              onClick={() => setSearch("")}
                            >
                              Clear ×
                            </button>
                          )}
                        </span>
                      </label>

                      <div className="inbox-directory-actions">
                        <button
                          className="btn btn-primary clients-findbar-add"
                          type="button"
                          onClick={() => {
                            setView("new");
                            setSearch("");
                            setInternalRequestOpen(true);
                          }}
                        >
                          + New Request
                        </button>
                        <Link className="btn clients-findbar-add inbox-public-form-action" to="/request">
                          Public Form ↗
                        </Link>
                      </div>
                    </div>

                    <div className="clients-directory-tools">
                      <div className="clients-view-control" aria-label="Inbox view">
                        <span className="clients-tool-label">View</span>
                        <div className="admin-filter-tabs clients-filter-tabs" aria-label="Inbox view filter">
                          <button
                            aria-pressed={view === "new"}
                            className={view === "new" ? "is-active" : undefined}
                            type="button"
                            onClick={() => changeView("new")}
                          >
                            <span>New</span>
                            <strong>{openCount}</strong>
                          </button>
                          <button
                            aria-pressed={view === "history"}
                            className={view === "history" ? "is-active" : undefined}
                            type="button"
                            onClick={() => changeView("history")}
                          >
                            <span>History</span>
                            <strong>{historyCount}</strong>
                          </button>
                        </div>
                      </div>

                      <button
                        className="clients-most-recent"
                        type="button"
                        onClick={() => setSearch("")}
                      >
                        Most recent first
                        <span aria-hidden="true">↓</span>
                      </button>
                    </div>

                    <div className="clients-directory-content">
                      <div className="clients-directory-count">
                        <span>
                          {visibleRequests.length} {view === "new" ? "new" : "history"} request{visibleRequests.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          {search.trim() ? `matching “${search.trim()}”` : "Most recently submitted first"}
                        </span>
                      </div>

                      {visibleRequests.length === 0 ? (
                        <div className="clients-empty inbox-directory-empty">
                          <strong>{view === "new" ? "Inbox clear." : "No history yet."}</strong>
                          <span>{search ? "Try a different search." : view === "new" ? "New requests will appear here." : "Resolved requests will appear here."}</span>
                        </div>
                      ) : (
                        <>
                          <div className="clients-directory-columns" aria-hidden="true">
                            <span>Client</span>
                            <span>Request</span>
                            <span>Service property</span>
                            <span>Submitted</span>
                            <span />
                          </div>

                          <div className="clients-directory-grid">
                            {visibleRequests.map((request) => {
                              const sender = request.submittedName ?? request.clientName ?? "Unknown sender";
                              return (
                                <button
                                  className={request.id === selectedId
                                    ? "client-directory-card inbox-directory-card is-selected"
                                    : "client-directory-card inbox-directory-card"}
                                  key={request.id}
                                  type="button"
                                  onClick={() => openRequest(request.id)}
                                >
                                  <div className="client-directory-identity">
                                    <strong>{sender}</strong>
                                  </div>

                                  <div className="client-directory-contact">
                                    <strong>{request.title}</strong>
                                    <span>{inboxStatusLabel(request)}</span>
                                  </div>

                                  <div className="client-directory-property">
                                    <strong>{requestAddress(request) || request.description?.trim() || "No service address"}</strong>
                                  </div>

                                  <div className="client-directory-updated">
                                    <span>Submitted</span>
                                    <strong>{dateTime(request.submittedAt)}</strong>
                                  </div>

                                  <span className="client-directory-open">Open →</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </section>

                  {!selected || !draft ? null : (
                    <div ref={detailRef} className="inbox-clean-detail-focus">
                      {jobComposerOpen && selected.status === "open" ? (
                    <form className="inbox-clean-detail inbox-clean-job" onSubmit={(event) => void approve(event)}>
                      <header className="inbox-clean-detail-head">
                        <div>
                          <p className="eyebrow">Create Job</p>
                          <h2>{selected.title}</h2>
                          <p>Confirm only what should become the Job. The original Request remains unchanged.</p>
                        </div>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            setJobComposerOpen(false);
                            setClientPickerOpen(false);
                            setMessage(null);
                          }}
                        >
                          ← Request
                        </button>
                      </header>

                      <div className="inbox-clean-job-client">
                        <div>
                          <span>Client</span>
                          {draftClient ? (
                            <><strong>{draftClient.name}</strong><small>Confirmed client record</small></>
                          ) : suggestedClient ? (
                            <><strong>{suggestedClient.name}</strong><small>{selected.matchReason ?? "Possible existing client match"}</small></>
                          ) : (
                            <><strong>{selected.submittedName ?? "Client needed"}</strong><small>Choose or create a Client before creating the Job.</small></>
                          )}
                        </div>
                        <div className="inbox-clean-inline-actions">
                          {!draftClient && suggestedClient ? (
                            <button
                              className="btn btn-primary"
                              disabled={busy !== null}
                              type="button"
                              onClick={() => {
                                updateDraft("clientId", suggestedClient.id);
                                setClientPickerOpen(false);
                                setMessage(null);
                              }}
                            >
                              Use {suggestedClient.name}
                            </button>
                          ) : null}
                          {!draftClient && !suggestedClient ? (
                            <button
                              className="btn btn-primary"
                              disabled={busy !== null}
                              type="button"
                              onClick={() => void createClientFromRequest()}
                            >
                              {busy === "client" ? "Creating…" : "Create Client"}
                            </button>
                          ) : null}
                          <button
                            className="btn"
                            disabled={busy !== null}
                            type="button"
                            onClick={() => setClientPickerOpen((current) => !current)}
                          >
                            {clientPickerOpen ? "Close" : draftClient ? "Change Client" : "Choose Client"}
                          </button>
                        </div>
                      </div>

                      {clientPickerOpen ? (
                        <label className="field inbox-clean-client-picker">Existing client
                          <select
                            className="select"
                            value={draft.clientId}
                            onChange={(event) => {
                              updateDraft("clientId", event.target.value);
                              if (event.target.value) setClientPickerOpen(false);
                            }}
                          >
                            <option value="">Choose Client…</option>
                            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                          </select>
                        </label>
                      ) : null}

                      <div className="inbox-clean-job-fields">
                        <label className="field">Job title
                          <input
                            className="input"
                            required
                            value={draft.title}
                            onChange={(event) => updateDraft("title", event.target.value)}
                          />
                        </label>
                        <label className="field">Scope
                          <textarea
                            className="textarea"
                            rows={3}
                            value={draft.description ?? ""}
                            onChange={(event) => updateDraft("description", event.target.value)}
                          />
                        </label>
                      </div>

                      <div className="inbox-clean-facts inbox-clean-carryover">
                        <div><span>Service address</span><strong>{requestAddress(selected) || "Not provided"}</strong></div>
                        <div><span>Preferred timing</span><strong>{selected.preferredTiming || "No preference"}</strong></div>
                      </div>

                      {message && <div className="notice request-review-notice">{message}</div>}

                      <footer className="inbox-clean-detail-footer">
                        <div>
                          <strong>Create one Job from this Request.</strong>
                          <span>The Request stays in Inbox history as the source record.</span>
                        </div>
                        <button
                          className="btn btn-primary"
                          disabled={busy !== null || !draft.clientId || !draft.title.trim()}
                          type="submit"
                        >
                          {busy === "approve" ? "Creating Job…" : "Create Job →"}
                        </button>
                      </footer>
                    </form>
                  ) : (
                    <article className="inbox-clean-detail">
                      <header className="inbox-clean-detail-head">
                        <div>
                          <p className="eyebrow">{selected.status === "open" ? "Selected Request" : "Request History"}</p>
                          <h2>{selected.title}</h2>
                          <p>{selected.submittedName ?? selected.clientName ?? "Unknown sender"} · {dateTime(selected.submittedAt)}</p>
                        </div>
                        <div className="inbox-clean-detail-nav">
                          <span className={`inbox-clean-status request-status-${selected.status}`}>{inboxStatusLabel(selected)}</span>
                          <button className="btn" type="button" onClick={returnToRequests}>← Back to Requests</button>
                        </div>
                      </header>

                      <div className="inbox-clean-facts">
                        <div>
                          <span>Contact</span>
                          <strong>{selected.submittedPhone || "No phone"}</strong>
                          <small>{selected.submittedEmail || "No email"}</small>
                        </div>
                        <div>
                          <span>Service address</span>
                          <strong>{requestAddress(selected) || "Not provided"}</strong>
                        </div>
                        <div>
                          <span>Preferred timing</span>
                          <strong>{selected.preferredTiming || "No preference"}</strong>
                          {selected.preferredContact ? <small>Prefers {selected.preferredContact}</small> : null}
                        </div>
                      </div>

                      <section className="inbox-clean-request-copy">
                        <span>Request</span>
                        <p>{selected.description ?? "No message provided."}</p>
                      </section>

                      {selected.media.length > 0 ? (
                        <section className="inbox-clean-photos">
                          <div><span>Photos</span><strong>{selected.media.length} attached</strong></div>
                          <div className="request-photo-strip">
                            {selected.media.map((photo) => (
                              <a href={photo.url} key={photo.id} target="_blank" rel="noreferrer">
                                <img src={photo.url} alt={photo.originalFilename ?? "Incoming work photo"} />
                              </a>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {selected.status === "open" ? (
                        <footer className="inbox-clean-detail-footer">
                          <div>
                            <strong>Request only · no Job yet.</strong>
                            <span>Review what came in, then decide whether to take the work.</span>
                          </div>
                          <div className="inbox-clean-inline-actions">
                            <button
                              className="btn"
                              disabled={busy !== null}
                              type="button"
                              onClick={() => void decline()}
                            >
                              {busy === "decline" ? "Declining…" : "Decline"}
                            </button>
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={() => {
                                setJobComposerOpen(true);
                                setMessage(null);
                              }}
                            >
                              Create Job →
                            </button>
                          </div>
                        </footer>
                      ) : (
                        <footer className="inbox-clean-detail-footer inbox-clean-detail-footer-history">
                          <div>
                            <strong>{selected.status === "approved" ? "Job created" : "Request declined"}</strong>
                            <span>{selected.declineReason ? `Reason: ${selected.declineReason}` : "This Request is resolved."}</span>
                          </div>
                          {selected.approvedJobId ? <Link className="btn btn-primary" to={`/app/jobs/${selected.approvedJobId}`}>Open Job →</Link> : null}
                        </footer>
                      )}
                    </article>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
