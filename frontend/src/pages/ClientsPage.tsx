import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router";
import type {
  Client,
  CreateClientInput,
} from "@vizow/shared";

import {
  createClient,
  fetchClients,
} from "../api/clients";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { AppLayout } from "../layouts/AppLayout";
import { WorkspaceHero } from "../components/WorkspaceHero";
import "../styles/clients-workspace.css";

type ClientsState =
  | { status: "loading" }
  | { status: "ready"; clients: Client[] }
  | { status: "error"; message: string };

type MutationState =
  | { status: "idle" }
  | { status: "working"; name: string }
  | { status: "success"; name: string }
  | {
      status: "error";
      name: string;
      message: string;
    };

type ClientFilter = "active" | "archived";
type ClientSortKey = "name" | "property" | "updated";
type SortDirection = "asc" | "desc";

type ClientDraft = {
  name: string;
  email: string;
  phone: string;
  notes: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
};

const emptyDraft: ClientDraft = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

function formatAddress(client: Client): string {
  const address = client.defaultAddress;

  if (!address) {
    return "No default Property";
  }

  return [
    [address.addressLine1, address.addressLine2]
      .filter(Boolean)
      .join(", "),
    [address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sortClients(clients: Client[]): Client[] {
  return [...clients].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

export function ClientsPage() {
  const [state, setState] = useState<ClientsState>({
    status: "loading",
  });
  const [mutation, setMutation] = useState<MutationState>({
    status: "idle",
  });
  const [filter, setFilter] =
    useState<ClientFilter>("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<ClientSortKey>("updated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [newClientOpen, setNewClientOpen] =
    useState(false);
  const [draft, setDraft] = useState<ClientDraft>(() => ({
    ...emptyDraft,
  }));

  useEffect(() => {
    const controller = new AbortController();

    fetchClients(controller.signal, true)
      .then((clients) => {
        setState({
          status: "ready",
          clients: sortClients(clients),
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
              : "Unable to load Clients.",
        });
      });

    return () => {
      controller.abort();
    };
  }, []);

  const clients =
    state.status === "ready" ? state.clients : [];

  const activeCount = clients.filter(
    (client) => client.archivedAt === null,
  ).length;

  const archivedCount = clients.filter(
    (client) => client.archivedAt !== null,
  ).length;

  const visibleClients = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const matches = clients.filter((client) => {
      const matchesFilter =
        filter === "active"
          ? client.archivedAt === null
          : client.archivedAt !== null;

      if (!matchesFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        client.name,
        client.email,
        client.phone,
        client.notes,
        formatAddress(client),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });

    return [...matches].sort((first, second) => {
      let comparison = 0;

      if (sortKey === "updated") {
        comparison =
          new Date(first.archivedAt ?? first.updatedAt).getTime() -
          new Date(second.archivedAt ?? second.updatedAt).getTime();
      } else if (sortKey === "property") {
        comparison = formatAddress(first).localeCompare(formatAddress(second));
      } else {
        comparison = first.name.localeCompare(second.name);
      }

      if (comparison === 0) {
        comparison = first.name.localeCompare(second.name);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [clients, filter, searchTerm, sortDirection, sortKey]);

  function changeSort(nextKey: ClientSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "updated" ? "desc" : "asc");
  }

  function sortArrow(key: ClientSortKey) {
    if (key !== sortKey) {
      return "";
    }

    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  function updateDraft(
    field: keyof ClientDraft,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCreateClient(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (state.status !== "ready") {
      return;
    }

    const name = draft.name.trim();

    if (!name) {
      setMutation({
        status: "error",
        name: "New Client",
        message: "Client name is required.",
      });
      return;
    }

    const hasAddress = [
      draft.addressLine1,
      draft.addressLine2,
      draft.city,
      draft.state,
      draft.postalCode,
    ].some((value) => value.trim());

    if (
      hasAddress &&
      (
        !draft.addressLine1.trim() ||
        !draft.city.trim() ||
        !draft.state.trim() ||
        !draft.postalCode.trim()
      )
    ) {
      setMutation({
        status: "error",
        name,
        message:
          "Address line 1, city, state, and postal code are required when saving a Property.",
      });
      return;
    }

    const input: CreateClientInput = {
      name,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      notes: draft.notes.trim() || null,
      defaultAddress: hasAddress
        ? {
            label: "Primary",
            addressLine1: draft.addressLine1.trim(),
            addressLine2:
              draft.addressLine2.trim() || null,
            city: draft.city.trim(),
            state: draft.state.trim(),
            postalCode: draft.postalCode.trim(),
          }
        : null,
    };

    setMutation({
      status: "working",
      name,
    });

    try {
      const client = await createClient(input);

      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              clients: sortClients([
                ...current.clients,
                client,
              ]),
            }
          : current,
      );

      setDraft({ ...emptyDraft });
      setNewClientOpen(false);
      setFilter("active");
      setMutation({
        status: "success",
        name: client.name,
      });
    } catch (error: unknown) {
      setMutation({
        status: "error",
        name,
        message:
          error instanceof Error
            ? error.message
            : "Unable to create Client.",
      });
    }
  }

  const railAction =
    mutation.status === "idle"
      ? filter === "active"
        ? "Review active Clients"
        : "Review archived Clients"
      : "Create Client";

  const railResult =
    mutation.status === "working"
      ? "Saving"
      : mutation.status === "success"
        ? "Client created"
        : mutation.status === "error"
          ? "Not saved"
          : state.status === "loading"
            ? "Loading"
            : state.status === "error"
              ? "Not loaded"
              : filter === "active"
                ? `${activeCount} active`
                : `${archivedCount} archived`;

  const railMessage =
    mutation.status === "working"
      ? `${mutation.name} is being saved.`
      : mutation.status === "success"
        ? `${mutation.name} was saved as an active Client.`
        : mutation.status === "error"
          ? `${mutation.message} Nothing was changed.`
          : state.status === "loading"
            ? "Loading Clients from VIZOW."
            : state.status === "error"
              ? "Clients could not be loaded. Nothing was changed."
              : filter === "active"
                ? `${activeCount} active Client${
                    activeCount === 1 ? "" : "s"
                  } available to review.`
                : `${archivedCount} archived Client${
                    archivedCount === 1 ? "" : "s"
                  } retained with complete history.`;

  return (
    <AppLayout
      object={
        mutation.status === "idle"
          ? filter === "active"
            ? "Active Clients"
            : "Archived Clients"
          : mutation.name
      }
      tool="Clients"
      action={railAction}
      result={railResult}
      message={railMessage}
      activeStep={
        mutation.status === "working"
          ? "result"
          : "action"
      }
      resultTone={
        mutation.status === "working" ||
        state.status === "loading"
          ? "working"
          : mutation.status === "error" ||
              state.status === "error"
            ? "error"
            : "success"
      }
      sections={[{ id: "clients-list", label: "Clients" }]}
    >
      <div className="page">
        <div className="admin-page clients-page workspace-canonical-page">
          <WorkspaceHero
            eyebrow="Client Directory"
            title="Clients"
            description={
              <>
                Type anything you remember — name, phone, email, or service
                address. Open the record when you find it.
              </>
            }
            metrics={
              state.status === "ready"
                ? [
                    { label: "Active", value: activeCount },
                    { label: "Archived", value: archivedCount },
                    { label: "Total", value: activeCount + archivedCount },
                  ]
                : []
            }
          />

          <section className="clients-directory-shell" id="clients-list">
            <div className="clients-directory-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2>
                  {filter === "active" ? "Active clients" : "Archived clients"}
                </h2>
              </div>


            </div>

            <div className="clients-findbar">
              <label className="clients-search">
                <span className="clients-search-kicker">Find a client</span>
                <span className="clients-search-control">
                  <input
                    aria-label="Search Clients"
                    placeholder="Type a name, phone, email, or address…"
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

              <button
                className="btn btn-primary clients-findbar-add"
                type="button"
                disabled={mutation.status === "working"}
                onClick={() => {
                  setNewClientOpen((current) => !current);
                  setMutation({ status: "idle" });
                }}
              >
                {newClientOpen ? "Close" : "+ New Client"}
              </button>
            </div>

            <div className="clients-directory-tools">
              <div className="clients-view-control" aria-label="Client view">
                <span className="clients-tool-label">View</span>
                <div
                  className="admin-filter-tabs clients-filter-tabs"
                  aria-label="Client status filter"
                >
                  <button
                    aria-pressed={filter === "active"}
                    className={filter === "active" ? "is-active" : undefined}
                    type="button"
                    onClick={() => {
                      setFilter("active");
                      setMutation({ status: "idle" });
                    }}
                  >
                    <span>Active</span>
                    <strong>{activeCount}</strong>
                  </button>

                  <button
                    aria-pressed={filter === "archived"}
                    className={filter === "archived" ? "is-active" : undefined}
                    type="button"
                    onClick={() => {
                      setFilter("archived");
                      setMutation({ status: "idle" });
                    }}
                  >
                    <span>Archived</span>
                    <strong>{archivedCount}</strong>
                  </button>
                </div>
              </div>

              <button
                className="clients-most-recent"
                type="button"
                onClick={() => {
                  setSortKey("updated");
                  setSortDirection("desc");
                }}
              >
                Most recent first
                <span aria-hidden="true">↓</span>
              </button>
            </div>
          {newClientOpen && (
            <form
              className="clients-create-panel"
              onSubmit={handleCreateClient}
            >
              <div className="clients-panel-heading">
                <div>
                  <p className="eyebrow">
                    Client Record
                  </p>
                  <h2>Add New Client</h2>
                </div>

                <span>
                  Default Property is optional.
                </span>
              </div>

              <div className="clients-form-grid">
                <label className="field">
                  Client name
                  <input
                    autoComplete="name"
                    className="input"
                    type="text"
                    required
                    value={draft.name}
                    onChange={(event) =>
                      updateDraft(
                        "name",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field">
                  Phone
                  <input
                    autoComplete="tel"
                    className="input"
                    type="tel"
                    value={draft.phone}
                    onChange={(event) =>
                      updateDraft(
                        "phone",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field">
                  Email
                  <input
                    autoComplete="email"
                    className="input"
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      updateDraft(
                        "email",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field clients-field-wide">
                  Notes
                  <textarea
                    className="textarea"
                    value={draft.notes}
                    onChange={(event) =>
                      updateDraft(
                        "notes",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <div className="clients-property-heading">
                  Default service Property
                </div>

                <div className="field">
                  <label htmlFor="new-client-address-line1">
                    Address line 1
                  </label>

                  <AddressAutocomplete
                    id="new-client-address-line1"
                    placeholder="Start typing, or enter manually"
                    value={draft.addressLine1}
                    onValueChange={(value) => {
                      updateDraft(
                        "addressLine1",
                        value,
                      );

                      if (!value) {
                        updateDraft("city", "");
                        updateDraft("state", "");
                        updateDraft("postalCode", "");
                      }
                    }}
                    onSelect={(suggestion) => {
                      updateDraft(
                        "addressLine1",
                        suggestion.addressLine1,
                      );
                      updateDraft(
                        "city",
                        suggestion.city,
                      );
                      updateDraft(
                        "state",
                        suggestion.state,
                      );
                      updateDraft(
                        "postalCode",
                        suggestion.postalCode,
                      );
                    }}
                  />
                </div>

                <label className="field">
                  Address line 2
                  <input
                    autoComplete="address-line2"
                    className="input"
                    type="text"
                    value={draft.addressLine2}
                    onChange={(event) =>
                      updateDraft(
                        "addressLine2",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field">
                  City
                  <input
                    autoComplete="address-level2"
                    className="input"
                    type="text"
                    value={draft.city}
                    onChange={(event) =>
                      updateDraft(
                        "city",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field">
                  State
                  <input
                    autoComplete="address-level1"
                    className="input"
                    type="text"
                    value={draft.state}
                    onChange={(event) =>
                      updateDraft(
                        "state",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field">
                  Postal code
                  <input
                    autoComplete="postal-code"
                    className="input"
                    type="text"
                    value={draft.postalCode}
                    onChange={(event) =>
                      updateDraft(
                        "postalCode",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <div className="cluster">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={mutation.status === "working"}
                >
                  {mutation.status === "working"
                    ? "Saving Client…"
                    : "Save Client"}
                </button>

                <button
                  className="btn"
                  type="button"
                  disabled={mutation.status === "working"}
                  onClick={() => {
                    setNewClientOpen(false);
                    setDraft({ ...emptyDraft });
                    setMutation({ status: "idle" });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {mutation.status === "success" && (
            <section
              className="clients-message clients-message-success"
              role="status"
            >
              {mutation.name} was saved.
            </section>
          )}

          {mutation.status === "error" && (
            <section
              className="clients-message clients-message-error"
              role="alert"
            >
              {mutation.message}
            </section>
          )}

          {state.status === "loading" && (
            <section className="clients-message">
              Loading Clients…
            </section>
          )}

          {state.status === "error" && (
            <section className="clients-message clients-message-error">
              {state.message}
            </section>
          )}

          {state.status === "ready" && (
            <div className="clients-directory-content">
              <div className="clients-directory-count">
                <span>
                  {visibleClients.length} {filter} client{visibleClients.length === 1 ? "" : "s"}
                </span>
                <span>
                  {searchTerm.trim()
                    ? `matching “${searchTerm.trim()}”`
                    : sortKey === "updated" && sortDirection === "desc"
                      ? "Most recently updated first"
                      : "Click a column heading to sort"}
                </span>
              </div>

              {visibleClients.length === 0 ? (
                <div className="clients-empty">
                  No {filter} Clients match this search.
                </div>
              ) : (
                <>
                  <div className="clients-directory-columns">
                    <button
                      className={sortKey === "name" ? "is-active" : undefined}
                      type="button"
                      onClick={() => changeSort("name")}
                    >
                      Client{sortArrow("name")}
                    </button>
                    <span>Contact</span>
                    <button
                      className={sortKey === "property" ? "is-active" : undefined}
                      type="button"
                      onClick={() => changeSort("property")}
                    >
                      Service property{sortArrow("property")}
                    </button>
                    <button
                      className={sortKey === "updated" ? "is-active" : undefined}
                      type="button"
                      onClick={() => changeSort("updated")}
                    >
                      Updated{sortArrow("updated")}
                    </button>
                    <span />
                  </div>
                  <div className="clients-directory-grid">
                  {visibleClients.map((client) => (
                    <Link
                      className="client-directory-card"
                      key={client.id}
                      to={`/app/clients/${client.id}`}
                    >
                      <div className="client-directory-identity">
                        <strong>{client.name}</strong>
                        {client.archivedAt && (
                          <span className="clients-status-line">Archived</span>
                        )}
                      </div>

                      <div className="client-directory-contact">
                        <strong>{client.phone ?? "No phone"}</strong>
                        <span>{client.email ?? "No email"}</span>
                      </div>

                      <div className="client-directory-property">
                        <strong>{formatAddress(client)}</strong>
                      </div>

                      <div className="client-directory-updated">
                        <span>{filter === "active" ? "Updated" : "Archived"}</span>
                        <strong>{formatDate(client.archivedAt ?? client.updatedAt)}</strong>
                      </div>

                      <span className="client-directory-open">Open →</span>
                    </Link>
                  ))}
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
