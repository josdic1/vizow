import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useParams,
} from "react-router";
import type {
  ClientProperty,
  ClientRecord,
  CreateClientPropertyInput,
  Job,
  Request as WorkRequest,
  UpdateClientInput,
  UpdateClientPropertyInput,
} from "@vizow/shared";

import {
  archiveClient,
  archiveClientProperty,
  createClientProperty,
  fetchClient,
  restoreClient,
  restoreClientProperty,
  setDefaultClientProperty,
  updateClient,
  updateClientProperty,
} from "../api/clients";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { AppLayout } from "../layouts/AppLayout";
import "../styles/clients-workspace.css";

type ClientState =
  | { status: "loading" }
  | { status: "ready"; client: ClientRecord }
  | { status: "error"; message: string };

type MutationState =
  | { status: "idle" }
  | {
      status: "working";
      action: string;
      object: string;
    }
  | {
      status: "success";
      action: string;
      object: string;
      message: string;
    }
  | {
      status: "error";
      action: string;
      object: string;
      message: string;
    };

type ClientDraft = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

type PropertyDraft = {
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
};

type PropertyEditor = {
  propertyId: string | null;
  draft: PropertyDraft;
} | null;

type PendingConfirmation =
  | {
      kind: "client";
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: "property";
      property: ClientProperty;
      title: string;
      message: string;
      confirmLabel: string;
    }
  | null;

type WorkAddress = {
  serviceAddressLine1: string | null;
  serviceAddressLine2: string | null;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostalCode: string | null;
};

const emptyClientDraft: ClientDraft = {
  name: "",
  phone: "",
  email: "",
  notes: "",
};

const emptyPropertyDraft: PropertyDraft = {
  label: "Primary",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  isDefault: false,
};

function clientDraftFromRecord(
  client: ClientRecord,
): ClientDraft {
  return {
    name: client.name,
    phone: client.phone ?? "",
    email: client.email ?? "",
    notes: client.notes ?? "",
  };
}

function propertyDraftFromRecord(
  property: ClientProperty,
): PropertyDraft {
  return {
    label: property.label,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2 ?? "",
    city: property.city,
    state: property.state,
    postalCode: property.postalCode,
    isDefault: property.isDefault,
  };
}

function formatPropertyAddress(
  property: ClientProperty,
): string {
  return [
    [property.addressLine1, property.addressLine2]
      .filter(Boolean)
      .join(", "),
    [
      property.city,
      property.state,
      property.postalCode,
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function formatWorkAddress(
  work: WorkAddress,
): string {
  const address = [
    [
      work.serviceAddressLine1,
      work.serviceAddressLine2,
    ]
      .filter(Boolean)
      .join(", "),
    [
      work.serviceCity,
      work.serviceState,
      work.servicePostalCode,
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return address || "No service address recorded.";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

export function ClientDetailPage() {
  const { clientId } = useParams();

  const [state, setState] = useState<ClientState>({
    status: "loading",
  });

  const [mutation, setMutation] =
    useState<MutationState>({
      status: "idle",
    });

  const [editClientOpen, setEditClientOpen] =
    useState(false);

  const [clientDraft, setClientDraft] =
    useState<ClientDraft>({
      ...emptyClientDraft,
    });

  const [propertyEditor, setPropertyEditor] =
    useState<PropertyEditor>(null);

  const [
    pendingConfirmation,
    setPendingConfirmation,
  ] = useState<PendingConfirmation>(null);

  useEffect(() => {
    if (!clientId) {
      setState({
        status: "error",
        message: "Client identifier is missing.",
      });
      return;
    }

    const controller = new AbortController();

    fetchClient(clientId, controller.signal)
      .then((client) => {
        setState({
          status: "ready",
          client,
        });

        setClientDraft(
          clientDraftFromRecord(client),
        );
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
              : "Unable to load Client.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [clientId]);

  const client =
    state.status === "ready"
      ? state.client
      : null;

  const mutationWorking =
    mutation.status === "working";

  const activeProperties =
    client?.properties.filter(
      (property) => property.archivedAt === null,
    ) ?? [];

  const archivedProperties =
    client?.properties.filter(
      (property) => property.archivedAt !== null,
    ) ?? [];

  function replaceClient(
    nextClient: ClientRecord,
  ): void {
    setState({
      status: "ready",
      client: nextClient,
    });

    setClientDraft(
      clientDraftFromRecord(nextClient),
    );
  }

  function updateClientDraft(
    field: keyof ClientDraft,
    value: string,
  ): void {
    setClientDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePropertyDraft(
    field: keyof PropertyDraft,
    value: string | boolean,
  ): void {
    setPropertyEditor((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              [field]: value,
            },
          }
        : current,
    );
  }

  async function handleUpdateClient(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!clientId || !client) {
      return;
    }

    const name = clientDraft.name.trim();

    if (!name) {
      setMutation({
        status: "error",
        action: "Edit Client",
        object: client.name,
        message: "Client name is required.",
      });
      return;
    }

    const input: UpdateClientInput = {
      name,
      phone: clientDraft.phone.trim() || null,
      email: clientDraft.email.trim() || null,
      notes: clientDraft.notes.trim() || null,
    };

    const clientChanged =
      input.name !== client.name ||
      input.phone !== client.phone ||
      input.email !== client.email ||
      input.notes !== client.notes;

    if (!clientChanged) {
      setEditClientOpen(false);

      setMutation({
        status: "success",
        action: "Edit Client",
        object: client.name,
        message: "No Client changes were needed.",
      });
      return;
    }

    setMutation({
      status: "working",
      action: "Edit Client",
      object: client.name,
    });

    try {
      const nextClient = await updateClient(
        clientId,
        input,
      );

      replaceClient(nextClient);
      setEditClientOpen(false);

      setMutation({
        status: "success",
        action: "Edit Client",
        object: nextClient.name,
        message:
          `${nextClient.name} was updated and appended to Client history.`,
      });
    } catch (error: unknown) {
      setMutation({
        status: "error",
        action: "Edit Client",
        object: client.name,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update Client.",
      });
    }
  }

  async function handleClientArchiveChange(
    confirmed = false,
  ): Promise<void> {
    if (!clientId || !client) {
      return;
    }

    const archived = client.archivedAt !== null;
    const action = archived
      ? "Restore Client"
      : "Archive Client";

    if (!archived && !confirmed) {
      setPendingConfirmation({
        kind: "client",
        title: `Archive ${client.name}?`,
        message:
          "Existing Requests, Jobs, Properties, and history will remain. Nothing will be deleted.",
        confirmLabel: "Archive Client",
      });
      return;
    }

    setPendingConfirmation(null);

    setMutation({
      status: "working",
      action,
      object: client.name,
    });

    try {
      const nextClient = archived
        ? await restoreClient(clientId)
        : await archiveClient(clientId);

      replaceClient(nextClient);
      setEditClientOpen(false);
      setPropertyEditor(null);

      setMutation({
        status: "success",
        action,
        object: nextClient.name,
        message: archived
          ? `${nextClient.name} was restored to active work.`
          : `${nextClient.name} was archived. No records were deleted.`,
      });
    } catch (error: unknown) {
      setMutation({
        status: "error",
        action,
        object: client.name,
        message:
          error instanceof Error
            ? error.message
            : `Unable to ${archived ? "restore" : "archive"} Client.`,
      });
    }
  }

  async function handleSaveProperty(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      !clientId ||
      !client ||
      !propertyEditor
    ) {
      return;
    }

    const draft = propertyEditor.draft;
    const propertyName =
      draft.label.trim() || "Property";

    if (
      !draft.label.trim() ||
      !draft.addressLine1.trim() ||
      !draft.city.trim() ||
      !draft.state.trim() ||
      !draft.postalCode.trim()
    ) {
      setMutation({
        status: "error",
        action:
          propertyEditor.propertyId
            ? "Edit Property"
            : "Add Property",
        object: propertyName,
        message:
          "Property label, address line 1, city, state, and postal code are required.",
      });
      return;
    }

    const input: UpdateClientPropertyInput = {
      label: draft.label.trim(),
      addressLine1:
        draft.addressLine1.trim(),
      addressLine2:
        draft.addressLine2.trim() || null,
      city: draft.city.trim(),
      state: draft.state.trim(),
      postalCode:
        draft.postalCode.trim(),
    };

    const editing =
      propertyEditor.propertyId !== null;

    const originalProperty =
      editing && propertyEditor.propertyId
        ? client.properties.find(
            (property) =>
              property.id === propertyEditor.propertyId,
          ) ?? null
        : null;

    const propertyChanged =
      !originalProperty ||
      input.label !== originalProperty.label ||
      input.addressLine1 !== originalProperty.addressLine1 ||
      input.addressLine2 !== originalProperty.addressLine2 ||
      input.city !== originalProperty.city ||
      input.state !== originalProperty.state ||
      input.postalCode !== originalProperty.postalCode;

    const action = editing
      ? "Edit Property"
      : "Add Property";

    if (editing && !propertyChanged) {
      setPropertyEditor(null);

      setMutation({
        status: "success",
        action,
        object: propertyName,
        message: "No Property changes were needed.",
      });
      return;
    }

    setMutation({
      status: "working",
      action,
      object: propertyName,
    });

    try {
      let nextClient: ClientRecord;

      if (
        editing &&
        propertyEditor.propertyId
      ) {
        nextClient =
          await updateClientProperty(
            clientId,
            propertyEditor.propertyId,
            input,
          );

      } else {
        const createInput:
          CreateClientPropertyInput = {
            ...input,
            isDefault: draft.isDefault,
          };

        nextClient =
          await createClientProperty(
            clientId,
            createInput,
          );
      }

      replaceClient(nextClient);
      setPropertyEditor(null);

      setMutation({
        status: "success",
        action,
        object: propertyName,
        message: editing
          ? `${propertyName} was updated and appended to Client history.`
          : `${propertyName} was added to ${client.name}.`,
      });
    } catch (error: unknown) {
      setMutation({
        status: "error",
        action,
        object: propertyName,
        message:
          error instanceof Error
            ? error.message
            : `Unable to ${editing ? "update" : "add"} Property.`,
      });
    }
  }

  async function handlePropertyArchiveChange(
    property: ClientProperty,
    confirmed = false,
  ): Promise<void> {
    if (!clientId || !client) {
      return;
    }

    const archived =
      property.archivedAt !== null;

    const action = archived
      ? "Restore Property"
      : "Archive Property";

    if (!archived && !confirmed) {
      setPendingConfirmation({
        kind: "property",
        property,
        title: `Archive ${property.label}?`,
        message:
          "Existing Requests and Jobs will keep their original address snapshots. Nothing will be deleted.",
        confirmLabel: "Archive Property",
      });
      return;
    }

    setPendingConfirmation(null);

    setMutation({
      status: "working",
      action,
      object: property.label,
    });

    try {
      const nextClient = archived
        ? await restoreClientProperty(
            clientId,
            property.id,
          )
        : await archiveClientProperty(
            clientId,
            property.id,
          );

      replaceClient(nextClient);
      setPropertyEditor(null);

      setMutation({
        status: "success",
        action,
        object: property.label,
        message: archived
          ? `${property.label} was restored to active use.`
          : `${property.label} was archived. Nothing was deleted.`,
      });
    } catch (error: unknown) {
      setMutation({
        status: "error",
        action,
        object: property.label,
        message:
          error instanceof Error
            ? error.message
            : `Unable to ${archived ? "restore" : "archive"} Property.`,
      });
    }
  }

  function confirmPendingArchive(): void {
    const pending = pendingConfirmation;

    if (!pending) {
      return;
    }

    setPendingConfirmation(null);

    if (pending.kind === "client") {
      void handleClientArchiveChange(true);
      return;
    }

    void handlePropertyArchiveChange(
      pending.property,
      true,
    );
  }

  async function handleSetDefaultProperty(
    property: ClientProperty,
  ): Promise<void> {
    if (!clientId || !client) {
      return;
    }

    setMutation({
      status: "working",
      action: "Set Default Property",
      object: property.label,
    });

    try {
      const nextClient =
        await setDefaultClientProperty(
          clientId,
          property.id,
        );

      replaceClient(nextClient);

      setMutation({
        status: "success",
        action: "Set Default Property",
        object: property.label,
        message:
          `${property.label} is now the default Property for ${client.name}.`,
      });
    } catch (error: unknown) {
      setMutation({
        status: "error",
        action: "Set Default Property",
        object: property.label,
        message:
          error instanceof Error
            ? error.message
            : "Unable to change the default Property.",
      });
    }
  }

  function renderProperty(
    property: ClientProperty,
  ) {
    const archived =
      property.archivedAt !== null;

    return (
      <article
        className={[
          "client-property-card",
          archived
            ? "client-property-card-archived"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        key={property.id}
      >
        <div className="client-property-card-heading">
          <div>
            <div className="client-property-label-line">
              <h3>{property.label}</h3>

              {property.isDefault && (
                <span className="client-record-status is-default">
                  Default
                </span>
              )}

              {archived && (
                <span className="client-record-status is-archived">
                  Archived
                </span>
              )}
            </div>

            <p>
              {formatPropertyAddress(property)}
            </p>
          </div>

          <span className="client-property-date">
            Updated {formatDate(property.updatedAt)}
          </span>
        </div>

        <div className="client-record-actions">
          {!archived &&
            client?.archivedAt === null && (
              <>
                <button
                  className="btn"
                  type="button"
                  disabled={mutationWorking}
                  onClick={() => {
                    setPropertyEditor({
                      propertyId: property.id,
                      draft:
                        propertyDraftFromRecord(
                          property,
                        ),
                    });

                    setMutation({
                      status: "idle",
                    });
                  }}
                >
                  Edit
                </button>

                {!property.isDefault && (
                  <button
                    className="btn btn-primary client-default-action"
                    type="button"
                    disabled={mutationWorking}
                    onClick={() =>
                      void handleSetDefaultProperty(
                        property,
                      )
                    }
                  >
                    Set Default
                  </button>
                )}

                <button
                  className="btn client-archive-action"
                  type="button"
                  disabled={mutationWorking}
                  onClick={() =>
                    void handlePropertyArchiveChange(
                      property,
                    )
                  }
                >
                  Archive
                </button>
              </>
            )}

          {archived &&
            client?.archivedAt === null && (
              <button
                className="btn"
                type="button"
                disabled={mutationWorking}
                onClick={() =>
                  void handlePropertyArchiveChange(
                    property,
                  )
                }
              >
                Restore
              </button>
            )}
        </div>
      </article>
    );
  }

  const railObject =
    mutation.status === "idle"
      ? client?.name ?? "Client"
      : mutation.object;

  const railAction =
    mutation.status === "idle"
      ? "Review Client"
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
              ? "Confirmed"
              : client?.archivedAt
                ? "Archived"
                : "Active";

  const railMessage =
    state.status === "loading"
      ? "Loading the Client record from VIZOW."
      : state.status === "error"
        ? "The Client could not be loaded. Nothing was changed."
        : mutation.status === "working"
          ? `${mutation.action} is in progress.`
          : mutation.status === "error"
            ? `${mutation.message} Nothing was changed.`
            : mutation.status === "success"
              ? mutation.message
              : client?.archivedAt
                ? `${client.name} is archived. Existing work and history remain intact.`
                : `${client?.name ?? "Client"} is loaded with Properties, Requests, and Jobs.`;

  return (
    <AppLayout
      object={railObject}
      tool="Clients"
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
        <div className="admin-page client-detail-page">
          <div className="client-detail-top">
            <div>
              <div className="client-detail-title-line">
                <div>
                  <p className="eyebrow">
                    Client Record
                  </p>
                  <h1>
                    {client?.name ?? "Client"}
                  </h1>
                </div>

                {client && (
                  <span
                    className={[
                      "client-record-status",
                      client.archivedAt
                        ? "is-archived"
                        : "is-active",
                    ].join(" ")}
                  >
                    {client.archivedAt
                      ? "Archived"
                      : "Active"}
                  </span>
                )}
              </div>

              {client && (
                <div className="client-detail-meta">
                  <span>
                    {activeProperties.length} active{" "}
                    {activeProperties.length === 1
                      ? "Property"
                      : "Properties"}
                  </span>
                  <span>
                    {client.requests.length}{" "}
                    {client.requests.length === 1
                      ? "Request"
                      : "Requests"}
                  </span>
                  <span>
                    {client.jobs.length}{" "}
                    {client.jobs.length === 1
                      ? "Job"
                      : "Jobs"}
                  </span>
                </div>
              )}
            </div>

            <div className="client-record-actions">
              <Link className="btn" to="/clients">
                ← Clients
              </Link>

              {client && (
                <button
                  className={
                    client.archivedAt
                      ? "btn btn-primary"
                      : "btn client-archive-action"
                  }
                  type="button"
                  disabled={mutationWorking}
                  onClick={() =>
                    void handleClientArchiveChange()
                  }
                >
                  {client.archivedAt
                    ? "Restore Client"
                    : "Archive Client"}
                </button>
              )}
            </div>
          </div>

          {state.status === "loading" && (
            <section className="clients-message">
              Loading Client…
            </section>
          )}

          {state.status === "error" && (
            <section className="clients-message clients-message-error">
              {state.message}
            </section>
          )}

          {pendingConfirmation && (
            <div
              className="client-confirmation-backdrop"
              role="presentation"
            >
              <section
                className="client-confirmation-panel"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="client-confirmation-title"
                aria-describedby="client-confirmation-message"
              >
                <div>
                  <p className="eyebrow">Confirm Archive</p>
                  <h2 id="client-confirmation-title">
                    {pendingConfirmation.title}
                  </h2>
                  <p id="client-confirmation-message">
                    {pendingConfirmation.message}
                  </p>
                </div>

                <div className="client-record-actions">
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={mutationWorking}
                    onClick={confirmPendingArchive}
                  >
                    {pendingConfirmation.confirmLabel}
                  </button>

                  <button
                    className="btn"
                    type="button"
                    disabled={mutationWorking}
                    autoFocus
                    onClick={() =>
                      setPendingConfirmation(null)
                    }
                  >
                    Cancel
                  </button>
                </div>
              </section>
            </div>
          )}

          {mutation.status === "success" && (
            <section
              className="clients-message clients-message-success"
              role="status"
            >
              {mutation.message}
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

          {client && (
            <>
              <section className="client-record-section">
                <div className="client-record-section-heading">
                  <div>
                    <p className="eyebrow">
                      Client Identity
                    </p>
                    <h2>Contact Record</h2>
                  </div>

                  {!client.archivedAt && (
                    <button
                      className="btn"
                      type="button"
                      disabled={mutationWorking}
                      onClick={() => {
                        setEditClientOpen(
                          (current) => !current,
                        );

                        setClientDraft(
                          clientDraftFromRecord(
                            client,
                          ),
                        );

                        setMutation({
                          status: "idle",
                        });
                      }}
                    >
                      {editClientOpen
                        ? "Close"
                        : "Edit Client"}
                    </button>
                  )}
                </div>

                {editClientOpen ? (
                  <form
                    className="client-record-form"
                    onSubmit={handleUpdateClient}
                  >
                    <div className="clients-form-grid">
                      <label className="field">
                        Client name
                        <input
                          autoComplete="name"
                          className="input"
                          required
                          type="text"
                          value={clientDraft.name}
                          onChange={(event) =>
                            updateClientDraft(
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
                          value={clientDraft.phone}
                          onChange={(event) =>
                            updateClientDraft(
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
                          value={clientDraft.email}
                          onChange={(event) =>
                            updateClientDraft(
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
                          value={clientDraft.notes}
                          onChange={(event) =>
                            updateClientDraft(
                              "notes",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="client-record-actions">
                      <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={mutationWorking}
                      >
                        {mutationWorking
                          ? "Saving…"
                          : "Save Client"}
                      </button>

                      <button
                        className="btn"
                        type="button"
                        disabled={mutationWorking}
                        onClick={() => {
                          setEditClientOpen(false);
                          setClientDraft(
                            clientDraftFromRecord(
                              client,
                            ),
                          );
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="client-record-grid">
                    <article className="client-record-card">
                      <p className="eyebrow">
                        Contact
                      </p>
                      <h3>{client.name}</h3>

                      <dl>
                        <div>
                          <dt>Phone</dt>
                          <dd>
                            {client.phone ??
                              "Not provided"}
                          </dd>
                        </div>

                        <div>
                          <dt>Email</dt>
                          <dd>
                            {client.email ??
                              "Not provided"}
                          </dd>
                        </div>
                      </dl>
                    </article>

                    <article className="client-record-card">
                      <p className="eyebrow">
                        Default Property
                      </p>
                      <h3>
                        {client.defaultAddress
                          ?.label ??
                          "No default Property"}
                      </h3>
                      <p>
                        {client.defaultAddress
                          ? formatPropertyAddress(
                              client.defaultAddress,
                            )
                          : "No active default service Property is saved."}
                      </p>
                    </article>

                    <article className="client-record-card client-record-wide">
                      <p className="eyebrow">
                        Notes
                      </p>
                      <p>
                        {client.notes ??
                          "No Client notes saved."}
                      </p>
                    </article>
                  </div>
                )}
              </section>

              <section className="client-record-section">
                <div className="client-record-section-heading">
                  <div>
                    <p className="eyebrow">
                      Saved Locations
                    </p>
                    <h2>Properties</h2>
                    <p>
                      Property edits do not rewrite
                      addresses already stored on
                      Requests or Jobs.
                    </p>
                  </div>

                  {!client.archivedAt && (
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={mutationWorking}
                      onClick={() => {
                        setPropertyEditor({
                          propertyId: null,
                          draft: {
                            ...emptyPropertyDraft,
                            isDefault:
                              activeProperties.length === 0,
                          },
                        });

                        setMutation({
                          status: "idle",
                        });
                      }}
                    >
                      + Add Property
                    </button>
                  )}
                </div>

                {propertyEditor && (
                  <form
                    className="client-property-form"
                    onSubmit={handleSaveProperty}
                  >
                    <div className="clients-panel-heading">
                      <div>
                        <p className="eyebrow">
                          Property Record
                        </p>
                        <h3>
                          {propertyEditor.propertyId
                            ? "Edit Property"
                            : "Add Property"}
                        </h3>
                      </div>
                    </div>

                    <div className="clients-form-grid">
                      <label className="field">
                        Property label
                        <input
                          className="input"
                          type="text"
                          required
                          value={
                            propertyEditor.draft.label
                          }
                          onChange={(event) =>
                            updatePropertyDraft(
                              "label",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <div className="field">
                        <label htmlFor="property-address-line1">
                          Address line 1
                        </label>

                        <AddressAutocomplete
                          id="property-address-line1"
                          required
                          placeholder="Start typing, or enter manually"
                          value={
                            propertyEditor.draft
                              .addressLine1
                          }
                          onValueChange={(value) => {
                            updatePropertyDraft(
                              "addressLine1",
                              value,
                            );

                            if (!value) {
                              updatePropertyDraft(
                                "city",
                                "",
                              );
                              updatePropertyDraft(
                                "state",
                                "",
                              );
                              updatePropertyDraft(
                                "postalCode",
                                "",
                              );
                            }
                          }}
                          onSelect={(suggestion) => {
                            updatePropertyDraft(
                              "addressLine1",
                              suggestion.addressLine1,
                            );
                            updatePropertyDraft(
                              "city",
                              suggestion.city,
                            );
                            updatePropertyDraft(
                              "state",
                              suggestion.state,
                            );
                            updatePropertyDraft(
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
                          value={
                            propertyEditor.draft
                              .addressLine2
                          }
                          onChange={(event) =>
                            updatePropertyDraft(
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
                          required
                          type="text"
                          value={propertyEditor.draft.city}
                          onChange={(event) =>
                            updatePropertyDraft(
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
                          required
                          type="text"
                          value={propertyEditor.draft.state}
                          onChange={(event) =>
                            updatePropertyDraft(
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
                          required
                          type="text"
                          value={
                            propertyEditor.draft
                              .postalCode
                          }
                          onChange={(event) =>
                            updatePropertyDraft(
                              "postalCode",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label className="client-property-default-control clients-field-wide">
                        <input
                          type="checkbox"
                          checked={
                            propertyEditor.draft
                              .isDefault
                          }
                          disabled={
                            propertyEditor.propertyId !== null
                          }
                          onChange={(event) =>
                            updatePropertyDraft(
                              "isDefault",
                              event.target.checked,
                            )
                          }
                        />

                        {propertyEditor.propertyId !== null
                          ? propertyEditor.draft.isDefault
                            ? "This is the default Property"
                            : "Use Set Default after saving edits"
                          : "Make this the default Property when saved"}
                      </label>
                    </div>

                    <div className="client-record-actions">
                      <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={mutationWorking}
                      >
                        {mutationWorking
                          ? "Saving…"
                          : propertyEditor.propertyId
                            ? "Save Property"
                            : "Add Property"}
                      </button>

                      <button
                        className="btn"
                        type="button"
                        disabled={mutationWorking}
                        onClick={() =>
                          setPropertyEditor(null)
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="client-properties-list">
                  {activeProperties.length > 0 ? (
                    activeProperties.map(
                      renderProperty,
                    )
                  ) : (
                    <div className="clients-empty">
                      No active Properties are saved.
                    </div>
                  )}
                </div>

                {archivedProperties.length > 0 && (
                  <div className="client-archived-properties">
                    <div className="client-record-subheading">
                      <h3>Archived Properties</h3>
                      <span>
                        {archivedProperties.length}
                      </span>
                    </div>

                    <div className="client-properties-list">
                      {archivedProperties.map(
                        renderProperty,
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section className="client-record-section">
                <div className="client-record-section-heading">
                  <div>
                    <p className="eyebrow">
                      Intake History
                    </p>
                    <h2>Requests</h2>
                  </div>

                  <Link
                    className="btn"
                    to={`/requests?clientId=${encodeURIComponent(
                      client.id,
                    )}`}
                  >
                    This Client’s Requests
                  </Link>
                </div>

                {client.requests.length > 0 ? (
                  <div className="client-activity-list">
                    {client.requests.map(
                      (
                        request: WorkRequest,
                      ) => (
                        <article
                          className="client-activity-row"
                          key={request.id}
                        >
                          <div>
                            <div className="client-activity-title">
                              <h3>
                                {request.title}
                              </h3>

                              <span
                                className={`client-record-status request-status-${request.status}`}
                              >
                                {formatLabel(
                                  request.status,
                                )}
                              </span>
                            </div>

                            <p>
                              {formatWorkAddress(
                                request,
                              )}
                            </p>

                            <small>
                              Submitted{" "}
                              {formatDate(
                                request.submittedAt,
                              )}
                            </small>
                          </div>

                          {request.approvedJobId && (
                            <div className="client-record-actions">
                              <Link
                                className="btn"
                                to={`/jobs/${request.approvedJobId}`}
                              >
                                Open Job
                              </Link>
                            </div>
                          )}
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="clients-empty">
                    No Requests are recorded for this
                    Client.
                  </div>
                )}
              </section>

              <section className="client-record-section">
                <div className="client-record-section-heading">
                  <div>
                    <p className="eyebrow">
                      Work History
                    </p>
                    <h2>Jobs</h2>
                  </div>

                  <Link
                    className="btn"
                    to={`/jobs?clientId=${encodeURIComponent(
                      client.id,
                    )}`}
                  >
                    This Client’s Jobs
                  </Link>
                </div>

                {client.jobs.length > 0 ? (
                  <div className="client-activity-list">
                    {client.jobs.map(
                      (job: Job) => (
                        <article
                          className="client-activity-row"
                          key={job.id}
                        >
                          <div>
                            <div className="client-activity-title">
                              <h3>{job.title}</h3>

                              <span
                                className={`client-record-status job-stage-${job.currentCycle.stage}`}
                              >
                                {formatLabel(
                                  job.currentCycle
                                    .stage,
                                )}
                              </span>
                            </div>

                            <p>
                              {formatWorkAddress(job)}
                            </p>

                            <small>
                              Cycle{" "}
                              {
                                job.currentCycle
                                  .cycleNumber
                              }
                              {" · "}
                              Updated{" "}
                              {formatDate(
                                job.updatedAt,
                              )}
                            </small>
                          </div>

                          <Link
                            className="btn"
                            to={`/jobs/${job.id}`}
                          >
                            Open Job
                          </Link>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="clients-empty">
                    No Jobs are recorded for this Client.
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
