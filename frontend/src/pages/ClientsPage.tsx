import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import type {
  Client,
  CreateClientInput,
} from "@vizow/shared";

import {
  createClient,
  fetchClients,
} from "../api/clients";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AppLayout } from "../layouts/AppLayout";
import "../styles/clients-workspace.css";

type ClientsState =
  | { status: "loading" }
  | { status: "ready"; clients: Client[] }
  | { status: "error"; message: string };

type MutationState =
  | { status: "idle" }
  | { status: "working"; name: string }
  | { status: "success"; name: string }
  | { status: "error"; name: string; message: string };

type ClientDraft = {
  name: string;
  email: string;
  phone: string;
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
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

function formatAddress(client: Client): string {
  const address = client.defaultAddress;

  if (!address) {
    return "No default property";
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

export function ClientsPage() {
  const [state, setState] = useState<ClientsState>({
    status: "loading",
  });
  const [mutation, setMutation] = useState<MutationState>({
    status: "idle",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [draft, setDraft] = useState<ClientDraft>(() => ({
    ...emptyDraft,
  }));

  useEffect(() => {
    const controller = new AbortController();

    fetchClients(controller.signal)
      .then((clients) => {
        setState({
          status: "ready",
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
              : "Unable to load Clients.",
        });
      });

    return () => {
      controller.abort();
    };
  }, []);

  const clients =
    state.status === "ready" ? state.clients : [];

  const visibleClients = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return clients;
    }

    return clients.filter((client) =>
      [
        client.name,
        client.email,
        client.phone,
        client.notes,
        formatAddress(client),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [clients, searchTerm]);

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
          "Address line 1, city, state, and postal code are required when saving a property.",
      });
      return;
    }

    const input: CreateClientInput = {
      name,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      notes: null,
      defaultAddress: hasAddress
        ? {
            label: "Primary",
            addressLine1: draft.addressLine1.trim(),
            addressLine2: draft.addressLine2.trim() || null,
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
              clients: [...current.clients, client].sort(
                (first, second) =>
                  first.name.localeCompare(second.name),
              ),
            }
          : current,
      );

      setDraft({ ...emptyDraft });
      setNewClientOpen(false);
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
    mutation.status === "working" ||
    mutation.status === "success" ||
    mutation.status === "error"
      ? "Create client"
      : "Review clients";

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
              : `${clients.length} loaded`;

  const railMessage =
    mutation.status === "working"
      ? `${mutation.name} is being saved.`
      : mutation.status === "success"
        ? `${mutation.name} was saved as a Client.`
        : mutation.status === "error"
          ? `${mutation.message} Nothing was changed.`
          : state.status === "loading"
            ? "Loading Clients from VIZOW."
            : state.status === "error"
              ? "Clients could not be loaded. Nothing was changed."
              : `${clients.length} Client${clients.length === 1 ? "" : "s"} available to review.`;

  return (
    <AppLayout
      object={
        mutation.status === "idle"
          ? "All Clients"
          : mutation.name
      }
      tool="Clients"
      action={railAction}
      result={railResult}
      message={railMessage}
      activeStep={
        mutation.status === "working" ? "result" : "action"
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
    >
      <div className="page">
        <div className="admin-page clients-page">
          <AdminPageHeader
            eyebrow="Visual of Work"
            title="Clients"
            description="Review Client contact information and saved service properties."
            meta={
              state.status === "ready" ? (
                <span>
                  {clients.length} total Client
                  {clients.length === 1 ? "" : "s"}
                </span>
              ) : undefined
            }
          />

          <div className="clients-toolbar">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setNewClientOpen((current) => !current);
                setMutation({ status: "idle" });
              }}
            >
              {newClientOpen ? "Close" : "+ New Client"}
            </button>

            <label className="clients-search">
              <span className="sr-only">Search Clients</span>
              <input
                placeholder="Name, phone, email, property…"
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </label>
          </div>

          {newClientOpen && (
            <form
              className="clients-create-panel"
              onSubmit={handleCreateClient}
            >
              <div className="clients-panel-heading">
                <div>
                  <p className="eyebrow">Client Record</p>
                  <h2>Add New Client</h2>
                </div>

                <span>Default property is optional.</span>
              </div>

              <div className="clients-form-grid">
                <label className="field">
                  Client name
                  <input
                    className="input"
                    type="text"
                    required
                    value={draft.name}
                    onChange={(event) =>
                      updateDraft("name", event.target.value)
                    }
                  />
                </label>

                <label className="field">
                  Phone
                  <input
                    className="input"
                    type="tel"
                    value={draft.phone}
                    onChange={(event) =>
                      updateDraft("phone", event.target.value)
                    }
                  />
                </label>

                <label className="field">
                  Email
                  <input
                    className="input"
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      updateDraft("email", event.target.value)
                    }
                  />
                </label>

                <div className="clients-property-heading">
                  Default service property
                </div>

                <label className="field">
                  Address line 1
                  <input
                    className="input"
                    type="text"
                    value={draft.addressLine1}
                    onChange={(event) =>
                      updateDraft(
                        "addressLine1",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field">
                  Address line 2
                  <input
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
                    className="input"
                    type="text"
                    value={draft.city}
                    onChange={(event) =>
                      updateDraft("city", event.target.value)
                    }
                  />
                </label>

                <label className="field">
                  State
                  <input
                    className="input"
                    type="text"
                    value={draft.state}
                    onChange={(event) =>
                      updateDraft("state", event.target.value)
                    }
                  />
                </label>

                <label className="field">
                  Postal code
                  <input
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
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
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
            <section className="clients-list">
              {visibleClients.length === 0 ? (
                <div className="clients-empty">
                  No Clients match this search.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Contact</th>
                      <th>Default property</th>
                      <th>Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleClients.map((client) => (
                      <tr key={client.id}>
                        <td data-label="Client">
                          <strong>{client.name}</strong>
                        </td>

                        <td data-label="Contact">
                          <span>{client.phone ?? "No phone"}</span>
                          <small>{client.email ?? "No email"}</small>
                        </td>

                        <td data-label="Default property">
                          {formatAddress(client)}
                        </td>

                        <td data-label="Updated">
                          {formatDate(client.updatedAt)}
                        </td>

                        <td data-label="Action">
                          <Link
                            className="clients-open-link"
                            to={`/clients/${client.id}`}
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
