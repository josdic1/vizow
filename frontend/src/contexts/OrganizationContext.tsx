import type { Organization } from "@vizow/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DemoSessionRequiredError, fetchOrganization } from "../api/organization";

type OrganizationStatus =
  | "loading"
  | "ready"
  | "error";

type OrganizationState = {
  organization: Organization | null;
  status: OrganizationStatus;
  error: string | null;
};

type OrganizationContextValue = OrganizationState & {
  reloadOrganization: () => void;
};

const OrganizationContext =
  createContext<OrganizationContextValue | null>(null);

const retryDelays = [0, 250, 750, 1500];

function wait(delay: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

export function OrganizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<OrganizationState>({
    organization: null,
    status: "loading",
    error: null,
  });

  const [reloadVersion, setReloadVersion] = useState(0);

  const reloadOrganization = useCallback(() => {
    setReloadVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setState((current) => ({
      organization: current.organization,
      status: "loading",
      error: null,
    }));

    async function loadOrganization(): Promise<void> {
      let lastError: unknown = null;

      for (const delay of retryDelays) {
        if (delay > 0) {
          await wait(delay);
        }

        if (cancelled) {
          return;
        }

        try {
          const organization = await fetchOrganization(
            controller.signal,
          );

          if (cancelled) {
            return;
          }

          setState({
            organization,
            status: "ready",
            error: null,
          });

          return;
        } catch (caughtError: unknown) {
          if (
            caughtError instanceof DOMException &&
            caughtError.name === "AbortError"
          ) {
            return;
          }

          if (caughtError instanceof DemoSessionRequiredError) {
            const publicDemoRoute =
              window.location.pathname === "/demo" ||
              window.location.pathname.startsWith("/demo/");

            if (!publicDemoRoute) {
              window.location.replace("/demo");
              return;
            }

            lastError = caughtError;
            break;
          }

          lastError = caughtError;
        }
      }

      if (cancelled) {
        return;
      }

      setState({
        organization: null,
        status: "error",
        error:
          lastError instanceof Error
            ? lastError.message
            : "Unable to load the organization.",
      });
    }

    void loadOrganization();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadVersion]);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      ...state,
      reloadOrganization,
    }),
    [reloadOrganization, state],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error(
      "useOrganization must be used inside OrganizationProvider.",
    );
  }

  return context;
}
