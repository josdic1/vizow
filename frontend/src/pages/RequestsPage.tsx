import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { Client, Request as WorkRequest, ReviewRequestInput } from "@vizow/shared";

import { createClient, fetchClients } from "../api/clients";
import { approveRequest, declineRequest, fetchRequests, reviewRequest } from "../api/requests";
import { InternalRequestComposer } from "../components/InternalRequestComposer";
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
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<InboxView>("new");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"approve" | "decline" | "client" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [internalRequestOpen, setInternalRequestOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchRequests(controller.signal), fetchClients(controller.signal, true)])
      .then(([requests, clients]) => {
        setState({ status: "ready", requests, clients });
        setSelectedId(
          requests.find((item) => item.status === "open")?.id ??
          requests.find((item) => item.status !== "open")?.id ??
          null,
        );
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
  }, [selectedId]);

  const visibleRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests.filter((request) => {
      const belongsInView = view === "new"
        ? request.status === "open"
        : request.status !== "open";
      if (!belongsInView) return false;
      if (!needle) return true;
      return [request.submittedName, request.clientName, request.title, request.description, requestAddress(request)]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
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
      navigate(`/jobs/${result.job.id}`);
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
          : selected?.submittedName ??
            selected?.clientName ??
            "—"
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
            ? "Review → Create Job"
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
      <div className="page requests-inbox-page">
        <div className="admin-page">
          <header className="request-inbox-titlebar">
            <div>
              <p className="eyebrow">Incoming Work</p>
              <h1>Inbox</h1>
            </div>
            <div className="request-inbox-titlebar-meta">
              <strong>{openCount} new</strong>
              <span>Review the request, then create the Job.</span>
            </div>
          </header>

          <div className="request-inbox-toolbar">
            <div className="admin-filter-tabs" aria-label="Inbox view">
              <button
                className={view === "new" ? "is-active" : undefined}
                type="button"
                onClick={() => changeView("new")}
              >
                New <strong>{openCount}</strong>
              </button>
              <button
                className={view === "history" ? "is-active" : undefined}
                type="button"
                onClick={() => changeView("history")}
              >
                History <strong>{historyCount}</strong>
              </button>
            </div>
            <input
              className="input request-inbox-search"
              aria-label="Search Inbox"
              placeholder="Name, work, address…"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="request-inbox-toolbar-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setInternalRequestOpen(true)}
              >
                + New Request
              </button>
              <Link className="btn" to="/request">Open Public Form</Link>
            </div>
          </div>

          {state.status === "loading" && <div className="notice">Loading Inbox…</div>}
          {state.status === "error" && <div className="notice notice-error">{state.message}</div>}

          {state.status === "ready" && (
            <div className="request-inbox-shell" id="inbox-work">
              <aside className="request-inbox-list" aria-label="Inbox items">
                {visibleRequests.map((request) => (
                  <button
                    className={request.id === selectedId ? "request-inbox-row is-active" : "request-inbox-row"}
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedId(request.id)}
                  >
                    <span className={`request-inbox-dot request-inbox-dot-${request.status}`} />
                    <span>
                      <strong>{request.submittedName ?? request.clientName ?? "Unknown sender"}</strong>
                      <span>{request.title}</span>
                    </span>
                    <small>{dateTime(request.submittedAt)}</small>
                  </button>
                ))}
                {visibleRequests.length === 0 && (
                  <div className="admin-empty-state">
                    {view === "new" ? "Inbox is clear." : "No resolved items."}
                  </div>
                )}
              </aside>

              {internalRequestOpen ? (
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
              ) : (
              <section className="request-review-panel">
                {!selected || !draft ? (
                  <div className="admin-empty-state">
                    {view === "new" ? "Nothing needs review." : "Select an item from History."}
                  </div>
                ) : (
                  <>
                    <header className="request-message-header">
                      <div className="request-message-heading">
                        <p className="eyebrow">Incoming work</p>
                        <h2>{selected.title}</h2>
                        <p>{selected.submittedName ?? selected.clientName ?? "Unknown sender"}</p>
                      </div>
                      <div className="request-message-meta">
                        <span className={`admin-status-chip request-status-${selected.status}`}>
                          {inboxStatusLabel(selected)}
                        </span>
                        <small>{dateTime(selected.submittedAt)}</small>
                      </div>
                    </header>

                    <div className="request-evidence-grid">
                      <div>
                        <span>Requester</span>
                        <strong>{selected.submittedName ?? selected.clientName ?? "Unknown sender"}</strong>
                        <small>{selected.preferredContact ? `Prefers ${selected.preferredContact}` : "Contact information"}</small>
                      </div>
                      <div>
                        <span>Contact</span>
                        <strong>{selected.submittedPhone ?? selected.submittedEmail ?? "Not provided"}</strong>
                        {selected.submittedPhone && selected.submittedEmail ? <small>{selected.submittedEmail}</small> : null}
                      </div>
                      <div className="request-evidence-address">
                        <span>Service address</span>
                        <strong>{requestAddress(selected) || "Not provided"}</strong>
                        {selected.preferredTiming ? <small>{selected.preferredTiming}</small> : null}
                      </div>
                    </div>

                    <section className="request-evidence-message" aria-label="Incoming request message">
                      <p className="eyebrow">Request</p>
                      <p>{selected.description ?? "No message provided."}</p>
                    </section>

                    {selected.media.length > 0 && (
                      <div className="request-photo-block">
                        <div className="request-photo-heading">
                          <p className="eyebrow">Photos</p>
                          <span>{selected.media.length} attached</span>
                        </div>
                        <div className="request-photo-strip">
                          {selected.media.map((photo) => (
                            <a href={photo.url} key={photo.id} target="_blank" rel="noreferrer">
                              <img src={photo.url} alt={photo.originalFilename ?? "Incoming work photo"} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {selected.status === "open" ? (
                      <form className="request-approval-form" onSubmit={(event) => void approve(event)}>
                        <div className="request-approval-heading">
                          <div>
                            <p className="eyebrow">Create Job</p>
                            <h2>Confirm the work</h2>
                            <p>Keep the incoming request intact. Confirm only what becomes the Job.</p>
                          </div>
                          <span className={draftClient ? "request-ready-state is-ready" : "request-ready-state"}>
                            {draftClient ? "Client ready" : "Client needed"}
                          </span>
                        </div>

                        <section className="request-client-choice">
                          <div className="request-client-choice-copy">
                            <p className="eyebrow">Client record</p>
                            {draftClient ? (
                              <>
                                <strong>{draftClient.name}</strong>
                                <span>Existing client selected for this Job.</span>
                              </>
                            ) : suggestedClient ? (
                              <>
                                <strong>Possible match: {suggestedClient.name}</strong>
                                <span>{selected.matchReason ?? "Vizow found an existing client that may match this request."}</span>
                              </>
                            ) : (
                              <>
                                <strong>New client · {selected.submittedName ?? "Unnamed requester"}</strong>
                                <span>No existing client is linked to this request.</span>
                              </>
                            )}
                          </div>

                          <div className="request-client-choice-actions">
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
                              {clientPickerOpen ? "Close Client List" : draftClient ? "Change Client" : "Choose Another"}
                            </button>
                          </div>
                        </section>

                        {clientPickerOpen ? (
                          <label className="field request-client-picker">
                            Choose existing client
                            <select
                              className="select"
                              value={draft.clientId}
                              onChange={(event) => {
                                updateDraft("clientId", event.target.value);
                                if (event.target.value) setClientPickerOpen(false);
                              }}
                            >
                              <option value="">Choose Client…</option>
                              {clients.map((client) => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        <div className="request-approval-grid">
                          <label className="field request-field-wide">Job title
                            <input
                              className="input"
                              required
                              value={draft.title}
                              onChange={(event) => updateDraft("title", event.target.value)}
                            />
                          </label>
                          <label className="field request-field-wide">Scope
                            <textarea
                              className="textarea"
                              rows={4}
                              value={draft.description ?? ""}
                              onChange={(event) => updateDraft("description", event.target.value)}
                            />
                          </label>
                        </div>

                        {message && <div className="notice request-review-notice">{message}</div>}
                        <div className="request-decision-row">
                          <button
                            className="btn btn-primary"
                            disabled={busy !== null || !draft.clientId || !draft.title.trim()}
                            type="submit"
                          >
                            {busy === "approve" ? "Creating Job…" : "Create Job"}
                          </button>
                          <button
                            className="btn"
                            disabled={busy !== null}
                            type="button"
                            onClick={() => void decline()}
                          >
                            {busy === "decline" ? "Declining…" : "Decline"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="request-resolution">
                        <p className="eyebrow">{selected.status === "approved" ? "Job created" : "Declined"}</p>
                        <h2>{selected.title}</h2>
                        <p>{selected.description}</p>
                        {selected.approvedJobId && (
                          <Link className="btn btn-primary" to={`/jobs/${selected.approvedJobId}`}>Open Job</Link>
                        )}
                        {selected.declineReason && <div className="notice">Reason: {selected.declineReason}</div>}
                      </div>
                    )}
                  </>
                )}
              </section>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
