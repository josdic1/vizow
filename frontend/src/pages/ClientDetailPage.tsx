import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Client } from "@vizow/shared";

import { fetchClient } from "../api/clients";
import { AppLayout } from "../layouts/AppLayout";
import "../styles/clients-workspace.css";

type ClientState =
  | { status: "loading" }
  | { status: "ready"; client: Client }
  | { status: "error"; message: string };

function formatAddress(client: Client): string {
  const address = client.defaultAddress;

  if (!address) {
    return "No default service property saved.";
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

export function ClientDetailPage() {
  const { clientId } = useParams();
  const [state, setState] = useState<ClientState>({
    status: "loading",
  });

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
    state.status === "ready" ? state.client : null;

  return (
    <AppLayout
      object={client?.name ?? "Client"}
      tool="Clients"
      action="Review client"
      result={
        state.status === "loading"
          ? "Loading"
          : state.status === "error"
            ? "Not loaded"
            : "Loaded"
      }
      message={
        state.status === "loading"
          ? "Loading the Client record from VIZOW."
          : state.status === "error"
            ? "The Client could not be loaded. Nothing was changed."
            : `${state.client.name} is loaded.`
      }
      activeStep={state.status === "loading" ? "result" : "action"}
      resultTone={
        state.status === "loading"
          ? "working"
          : state.status === "error"
            ? "error"
            : "success"
      }
    >
      <div className="page">
        <div className="admin-page client-detail-page">
          <div className="client-detail-top">
            <div>
              <p className="eyebrow">Client Record</p>
              <h1>{client?.name ?? "Client"}</h1>
            </div>

            <Link className="btn" to="/clients">
              ← Clients
            </Link>
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

          {client && (
            <section className="client-record-grid">
              <article className="client-record-card">
                <p className="eyebrow">Contact</p>
                <h2>{client.name}</h2>
                <dl>
                  <div>
                    <dt>Phone</dt>
                    <dd>{client.phone ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{client.email ?? "Not provided"}</dd>
                  </div>
                </dl>
              </article>

              <article className="client-record-card">
                <p className="eyebrow">Default Property</p>
                <h2>
                  {client.defaultAddress?.label ?? "No property"}
                </h2>
                <p>{formatAddress(client)}</p>
              </article>

              <article className="client-record-card client-record-wide">
                <p className="eyebrow">Notes</p>
                <p>{client.notes ?? "No Client notes saved."}</p>
              </article>
            </section>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
