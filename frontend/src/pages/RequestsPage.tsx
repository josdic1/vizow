import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import type {
  Client,
  CreateRequestInput,
  Request as WorkRequest,
} from "@vizow/shared";

import { fetchClients } from "../api/clients";
import {
  approveRequest,
  createRequest,
  fetchRequests,
} from "../api/requests";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AppLayout } from "../layouts/AppLayout";

type RequestsState =
  | { status: "loading" }
  | {
      status: "ready";
      requests: WorkRequest[];
      clients: Client[];
    }
  | { status: "error"; message: string };

type RequestMutationState =
  | { status: "idle" }
  | {
      status: "working";
      action: "Create request" | "Approve request";
      object: string;
    }
  | {
      status: "success";
      action: "Create request" | "Approve request";
      object: string;
      message: string;
      jobId?: string;
    }
  | {
      status: "error";
      action: "Create request" | "Approve request";
      object: string;
      message: string;
    };

const requestStatuses = ["open", "approved", "declined"] as const;

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAddress(request: WorkRequest): string | null {
  const street = [
    request.serviceAddressLine1,
    request.serviceAddressLine2,
  ]
    .filter(Boolean)
    .join(", ");

  const locality = [
    request.serviceCity,
    request.serviceState,
    request.servicePostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  return [street, locality].filter(Boolean).join(", ") || null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalFormText(
  formData: FormData,
  name: string,
): string | null {
  return formText(formData, name) || null;
}

export function RequestsPage() {
  const [state, setState] = useState<RequestsState>({
    status: "loading",
  });
  const [mutation, setMutation] = useState<RequestMutationState>({
    status: "idle",
  });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchRequests(controller.signal),
      fetchClients(controller.signal),
    ])
      .then(([requests, clients]) => {
        setState({
          status: "ready",
          requests,
          clients,
        });
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
              : "An unknown error occurred while loading requests.",
        });
      });

    return () => {
      controller.abort();
    };
  }, []);

  const requests =
    state.status === "ready" ? state.requests : [];

  const openRequestCount = requests.filter(
    (request) => request.status === "open",
  ).length;

  const visibleRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const nextRequests = requests.filter((request) => {
      if (
        statusFilter !== "ALL" &&
        request.status !== statusFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        request.clientName,
        request.title,
        request.description,
        formatAddress(request),
        request.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

    const statusOrder: Record<WorkRequest["status"], number> = {
      open: 0,
      approved: 1,
      declined: 2,
    };

    nextRequests.sort((first, second) => {
      const statusDifference =
        statusOrder[first.status] - statusOrder[second.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return second.submittedAt.localeCompare(first.submittedAt);
    });

    return nextRequests;
  }, [requests, searchTerm, statusFilter]);

  async function handleCreateRequest(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (state.status !== "ready") {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const clientId = formText(formData, "clientId");
    const title = formText(formData, "title");

    if (!clientId || !title) {
      setMutation({
        status: "error",
        action: "Create request",
        object: title || "New request",
        message: "Client and request title are required.",
      });
      return;
    }

    const input: CreateRequestInput = {
      clientId,
      title,
      description: optionalFormText(formData, "description"),
      serviceAddressLine1: optionalFormText(
        formData,
        "serviceAddressLine1",
      ),
      serviceAddressLine2: optionalFormText(
        formData,
        "serviceAddressLine2",
      ),
      serviceCity: optionalFormText(formData, "serviceCity"),
      serviceState: optionalFormText(formData, "serviceState"),
      servicePostalCode: optionalFormText(
        formData,
        "servicePostalCode",
      ),
    };

    setMutation({
      status: "working",
      action: "Create request",
      object: title,
    });

    try {
      const createdRequest = await createRequest(input);

      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              requests: [createdRequest, ...current.requests],
            }
          : current,
      );

      form.reset();

      setMutation({
        status: "success",
        action: "Create request",
        object: createdRequest.title,
        message: `${createdRequest.title} was created as an open Request.`,
      });
    } catch (error: unknown) {
      setMutation({
        status: "error",
        action: "Create request",
        object: title,
        message:
          error instanceof Error
            ? error.message
            : "An unknown error occurred while creating the Request.",
      });
    }
  }

  async function handleApproveRequest(request: WorkRequest) {
    setMutation({
      status: "working",
      action: "Approve request",
      object: request.title,
    });

    try {
      const result = await approveRequest(request.id);

      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              requests: current.requests.map((existingRequest) =>
                existingRequest.id === result.request.id
                  ? result.request
                  : existingRequest,
              ),
            }
          : current,
      );

      setMutation({
        status: "success",
        action: "Approve request",
        object: result.request.title,
        message: `${result.request.title} was approved and became a Job.`,
        jobId: result.job.id,
      });
    } catch (error: unknown) {
      setMutation({
        status: "error",
        action: "Approve request",
        object: request.title,
        message:
          error instanceof Error
            ? error.message
            : "An unknown error occurred while approving the Request.",
      });
    }
  }

  const mutationWorking = mutation.status === "working";

  const railObject =
    mutation.status === "idle" ? "All Requests" : mutation.object;

  const railAction =
    mutation.status === "idle"
      ? "Review requests"
      : mutation.action;

  const railResult =
    state.status === "loading"
      ? "Loading"
      : state.status === "error"
        ? "Not loaded"
        : mutation.status === "working"
          ? "Working"
          : mutation.status === "error"
            ? "Failed"
            : mutation.status === "success"
              ? mutation.jobId
                ? "Job created"
                : "Request created"
              : `${openRequestCount} open`;

  const railMessage =
    state.status === "loading"
      ? "Loading Requests and Clients from VIZOW."
      : state.status === "error"
        ? "Requests could not be loaded. Nothing was changed."
        : mutation.status === "working"
          ? `${mutation.action} is in progress.`
          : mutation.status === "error"
            ? `${mutation.message} Nothing was changed.`
            : mutation.status === "success"
              ? mutation.message
              : `${openRequestCount} open Request${
                  openRequestCount === 1 ? "" : "s"
                } require review.`;

  return (
    <AppLayout
      object={railObject}
      tool="Requests"
      action={railAction}
      result={railResult}
      message={railMessage}
      activeStep={
        state.status === "loading" ||
        state.status === "error" ||
        mutation.status !== "idle"
          ? "result"
          : "action"
      }
      resultTone={
        state.status === "loading" ||
        mutation.status === "working"
          ? "working"
          : state.status === "error" ||
              mutation.status === "error"
            ? "error"
            : "success"
      }
    >
      <div className="page">
        <div className="admin-page requests-page">
          <AdminPageHeader
            eyebrow="Visual of Work"
            title="Requests"
            description="Capture incoming work, review it, and approve it into a Job without losing its original history."
            meta={
              state.status === "ready" ? (
                <>
                  <span>
                    {state.requests.length} total Request
                    {state.requests.length === 1 ? "" : "s"}
                  </span>
                  <span>{openRequestCount} open</span>
                </>
              ) : undefined
            }
          />

          {state.status === "loading" && (
            <div className="notice">Loading Requests…</div>
          )}

          {state.status === "error" && (
            <div className="notice notice-error" role="alert">
              <strong>Requests could not be loaded.</strong>
              <p>{state.message}</p>
            </div>
          )}

          {state.status === "ready" && (
            <>
              <section
                className="requests-create-panel"
                aria-labelledby="new-request-heading"
              >
                <div className="section-heading">
                  <p className="eyebrow">Intake</p>
                  <h2 id="new-request-heading">New Request</h2>
                  <p>
                    Record what the client is asking for before it
                    becomes active work.
                  </p>
                </div>

                <form
                  className="form-stack"
                  onSubmit={handleCreateRequest}
                >
                  <div className="form-grid">
                    <label className="field">
                      Client
                      <select
                        className="select"
                        name="clientId"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Select a client
                        </option>

                        {state.clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      Request title
                      <input
                        className="input"
                        name="title"
                        type="text"
                        required
                        placeholder="Roof leak investigation"
                      />
                    </label>

                    <label className="field request-field-wide">
                      Description
                      <textarea
                        className="textarea"
                        name="description"
                        placeholder="What did the client report or ask for?"
                      />
                    </label>

                    <label className="field">
                      Address line 1
                      <input
                        className="input"
                        name="serviceAddressLine1"
                        type="text"
                      />
                    </label>

                    <label className="field">
                      Address line 2
                      <input
                        className="input"
                        name="serviceAddressLine2"
                        type="text"
                      />
                    </label>

                    <label className="field">
                      City
                      <input
                        className="input"
                        name="serviceCity"
                        type="text"
                      />
                    </label>

                    <label className="field">
                      State
                      <input
                        className="input"
                        name="serviceState"
                        type="text"
                        maxLength={50}
                      />
                    </label>

                    <label className="field">
                      Postal code
                      <input
                        className="input"
                        name="servicePostalCode"
                        type="text"
                      />
                    </label>
                  </div>

                  <div className="cluster">
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={
                        mutationWorking || state.clients.length === 0
                      }
                    >
                      {mutation.status === "working" &&
                      mutation.action === "Create request"
                        ? "Creating…"
                        : "Create Request"}
                    </button>
                  </div>
                </form>
              </section>

              {state.clients.length === 0 && (
                <div className="notice notice-error" role="alert">
                  A Client must exist before a Request can be created.
                </div>
              )}

              {mutation.status === "success" && (
                <div
                  className="notice notice-success request-result-notice"
                  role="status"
                >
                  <strong>{mutation.message}</strong>

                  {mutation.jobId && (
                    <Link
                      className="btn btn-primary"
                      to={`/jobs/${mutation.jobId}`}
                    >
                      Open Job
                    </Link>
                  )}
                </div>
              )}

              {mutation.status === "error" && (
                <div className="notice notice-error" role="alert">
                  <strong>{mutation.message}</strong>
                </div>
              )}

              <section className="requests-list-section">
                <div className="admin-toolbar requests-toolbar">
                  <div
                    className="admin-filter-tabs"
                    aria-label="Request status filter"
                  >
                    <button
                      aria-pressed={statusFilter === "ALL"}
                      className={
                        statusFilter === "ALL"
                          ? "is-active"
                          : undefined
                      }
                      type="button"
                      onClick={() => setStatusFilter("ALL")}
                    >
                      <span>All</span>
                      <strong>{requests.length}</strong>
                    </button>

                    {requestStatuses.map((status) => {
                      const count = requests.filter(
                        (request) => request.status === status,
                      ).length;

                      return (
                        <button
                          aria-pressed={statusFilter === status}
                          className={
                            statusFilter === status
                              ? "is-active"
                              : undefined
                          }
                          key={status}
                          type="button"
                          onClick={() => setStatusFilter(status)}
                        >
                          <span>{formatLabel(status)}</span>
                          <strong>{count}</strong>
                        </button>
                      );
                    })}
                  </div>

                  <div className="admin-toolbar-end">
                    <label className="admin-search-field">
                      <span className="sr-only">
                        Search Requests
                      </span>
                      <input
                        placeholder="Client, Request, address…"
                        type="search"
                        value={searchTerm}
                        onChange={(event) =>
                          setSearchTerm(event.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>

                {visibleRequests.length > 0 ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table requests-table">
                      <thead>
                        <tr>
                          <th>Client</th>
                          <th>Request</th>
                          <th>Service address</th>
                          <th>Status</th>
                          <th>Submitted</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {visibleRequests.map((request) => (
                          <tr key={request.id}>
                            <td data-label="Client">
                              <strong>{request.clientName}</strong>
                            </td>

                            <td data-label="Request">
                              <strong>{request.title}</strong>
                              <span className="admin-table-subline">
                                {request.description ??
                                  "No description recorded."}
                              </span>
                            </td>

                            <td data-label="Service address">
                              {formatAddress(request) ??
                                "No address recorded."}
                            </td>

                            <td data-label="Status">
                              <span
                                className={`admin-status-chip request-status-${request.status}`}
                              >
                                {formatLabel(request.status)}
                              </span>
                            </td>

                            <td data-label="Submitted">
                              {formatDate(request.submittedAt)}
                            </td>

                            <td data-label="Action">
                              <div className="request-actions">
                                {request.status === "open" && (
                                  <button
                                    className="btn btn-primary"
                                    type="button"
                                    disabled={mutationWorking}
                                    onClick={() =>
                                      handleApproveRequest(request)
                                    }
                                  >
                                    {mutation.status === "working" &&
                                    mutation.action ===
                                      "Approve request" &&
                                    mutation.object === request.title
                                      ? "Approving…"
                                      : "Approve"}
                                  </button>
                                )}

                                {request.status === "approved" &&
                                  request.approvedJobId && (
                                    <Link
                                      className="btn"
                                      to={`/jobs/${request.approvedJobId}`}
                                    >
                                      Open Job
                                    </Link>
                                  )}

                                {request.status === "declined" && (
                                  <span>Closed</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="admin-empty-state">
                    <strong>No Requests match these filters.</strong>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setStatusFilter("ALL");
                        setSearchTerm("");
                      }}
                    >
                      Clear filters
                    </button>
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
