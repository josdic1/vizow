import { useMemo, useState, type FormEvent } from "react";
import type { Client, Request as WorkRequest } from "@vizow/shared";

import { createClient } from "../api/clients";
import { createRequest } from "../api/requests";
import { AddressAutocomplete } from "./AddressAutocomplete";

type ClientMode = "existing" | "new";

type InternalRequestComposerProps = {
  clients: Client[];
  onClose: () => void;
  onCreated: (request: WorkRequest, createdClient: Client | null) => void;
};

type AddressDraft = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
};

const emptyAddress: AddressDraft = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

export function InternalRequestComposer({
  clients,
  onClose,
  onCreated,
}: InternalRequestComposerProps) {
  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState<AddressDraft>(emptyAddress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clientId, clients],
  );

  function applyClientAddress(nextClientId: string): void {
    setClientId(nextClientId);
    const client = clients.find((item) => item.id === nextClientId);
    const property = client?.defaultAddress;

    setAddress(
      property
        ? {
            addressLine1: property.addressLine1,
            addressLine2: property.addressLine2 ?? "",
            city: property.city,
            state: property.state,
            postalCode: property.postalCode,
          }
        : emptyAddress,
    );
  }

  function updateAddress(field: keyof AddressDraft, value: string): void {
    setAddress((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Add a work title.");
      return;
    }

    if (
      !address.addressLine1.trim() ||
      !address.city.trim() ||
      !address.state.trim() ||
      !address.postalCode.trim()
    ) {
      setError("Confirm the service address.");
      return;
    }

    if (clientMode === "existing" && !clientId) {
      setError("Choose the Client, or create a new one.");
      return;
    }

    if (clientMode === "new" && !newClientName.trim()) {
      setError("Add the new Client's name.");
      return;
    }

    setBusy(true);

    try {
      let requestClientId = clientId;
      let createdClient: Client | null = null;

      if (clientMode === "new") {
        createdClient = await createClient({
          name: newClientName.trim(),
          phone: newClientPhone.trim() || null,
          email: newClientEmail.trim() || null,
          notes: null,
          defaultAddress: {
            label: "Primary",
            addressLine1: address.addressLine1.trim(),
            addressLine2: address.addressLine2.trim() || null,
            city: address.city.trim(),
            state: address.state.trim(),
            postalCode: address.postalCode.trim(),
          },
        });
        requestClientId = createdClient.id;
      }

      const request = await createRequest({
        clientId: requestClientId,
        title: title.trim(),
        description: description.trim() || null,
        serviceAddressLine1: address.addressLine1.trim(),
        serviceAddressLine2: address.addressLine2.trim() || null,
        serviceCity: address.city.trim(),
        serviceState: address.state.trim(),
        servicePostalCode: address.postalCode.trim(),
      });

      onCreated(request, createdClient);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create Request.");
      setBusy(false);
    }
  }

  return (
    <section className="request-intake-panel" aria-labelledby="internal-request-heading">
      <header className="request-intake-header">
        <div>
          <p className="eyebrow">Internal Intake</p>
          <h2 id="internal-request-heading">New Request</h2>
          <p>Record incoming work. Saving puts it in Inbox for review; it does not create a Job.</p>
        </div>
        <button className="btn request-intake-cancel-top" disabled={busy} type="button" onClick={onClose}>
          Back to Inbox
        </button>
      </header>

      <form className="request-intake-form" onSubmit={(event) => void submit(event)}>
        <section className="request-intake-block">
          <div className="request-intake-block-head">
            <div>
              <p className="eyebrow">01 · Client</p>
              <h3>Who called?</h3>
            </div>
            <div className="request-client-mode-choice" role="group" aria-label="Choose existing or new client">
              <button
                className={clientMode === "existing" ? "is-active" : undefined}
                type="button"
                aria-pressed={clientMode === "existing"}
                onClick={() => {
                  setClientMode("existing");
                  setError(null);
                }}
              >
                <span>Existing client</span>
                <small>Choose someone already in Vizow</small>
              </button>
              <button
                className={clientMode === "new" ? "is-active" : undefined}
                type="button"
                aria-pressed={clientMode === "new"}
                onClick={() => {
                  setClientMode("new");
                  setClientId("");
                  setAddress(emptyAddress);
                  setError(null);
                }}
              >
                <span>New client</span>
                <small>Add contact + property</small>
              </button>
            </div>
          </div>

          {clientMode === "existing" ? (
            <label className="field">
              Client
              <select className="select" value={clientId} onChange={(event) => applyClientAddress(event.target.value)}>
                <option value="">Choose Client…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              {selectedClient?.defaultAddress ? (
                <small>Default property loaded below. Change it if this request is for another address.</small>
              ) : null}
            </label>
          ) : (
            <div className="request-intake-grid request-intake-client-grid">
              <label className="field request-intake-wide">
                Client name
                <input className="input" autoComplete="name" value={newClientName} onChange={(event) => setNewClientName(event.target.value)} />
              </label>
              <label className="field">
                Phone
                <input className="input" autoComplete="tel" type="tel" value={newClientPhone} onChange={(event) => setNewClientPhone(event.target.value)} />
              </label>
              <label className="field">
                Email
                <input className="input" autoComplete="email" type="email" value={newClientEmail} onChange={(event) => setNewClientEmail(event.target.value)} />
              </label>
            </div>
          )}
        </section>

        <section className="request-intake-block request-intake-work-block">
          <div className="request-intake-block-head">
            <div>
              <p className="eyebrow">02 · Work</p>
              <h3>What do they need?</h3>
            </div>
          </div>
          <div className="request-intake-grid">
            <label className="field request-intake-wide">
              Work title
              <input className="input" placeholder="Dining room dimmer buzzing" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field request-intake-wide">
              Description
              <textarea className="textarea" rows={3} placeholder="What did the client report or ask for?" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="request-intake-block">
          <div className="request-intake-block-head">
            <div>
              <p className="eyebrow">03 · Service Address</p>
              <h3>Where is the work?</h3>
            </div>
          </div>
          <div className="request-intake-grid request-intake-address-grid">
            <div className="field request-intake-wide">
              <label htmlFor="internal-request-address">Street address</label>
              <AddressAutocomplete
                id="internal-request-address"
                placeholder="Start typing an address"
                required
                value={address.addressLine1}
                onValueChange={(value) => {
                  updateAddress("addressLine1", value);
                  if (!value) setAddress(emptyAddress);
                }}
                onSelect={(suggestion) => {
                  setAddress((current) => ({
                    ...current,
                    addressLine1: suggestion.addressLine1,
                    city: suggestion.city,
                    state: suggestion.state,
                    postalCode: suggestion.postalCode,
                  }));
                }}
              />
            </div>
            <label className="field request-intake-wide">
              Apt / unit / suite
              <input className="input" autoComplete="address-line2" value={address.addressLine2} onChange={(event) => updateAddress("addressLine2", event.target.value)} />
            </label>
            <label className="field">
              City
              <input className="input" autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress("city", event.target.value)} />
            </label>
            <label className="field">
              State
              <input className="input" autoComplete="address-level1" value={address.state} onChange={(event) => updateAddress("state", event.target.value)} />
            </label>
            <label className="field">
              ZIP
              <input className="input" autoComplete="postal-code" value={address.postalCode} onChange={(event) => updateAddress("postalCode", event.target.value)} />
            </label>
          </div>
        </section>

        {error ? <div className="notice notice-error request-intake-error">{error}</div> : null}

        <footer className="request-intake-actions">
          <button className="btn" disabled={busy} type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Saving Request…" : "Save Request"}
          </button>
        </footer>
      </form>
    </section>
  );
}
