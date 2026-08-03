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

import { fetchOrganization } from "../api/organization";

type OrganizationStatus =
  | "loading"
  | "ready"
  | "error";

type OrganizationContextValue = {
  organization: Organization | null;
  status: OrganizationStatus;
  error: string | null;
  reloadOrganization: () => void;
};

const OrganizationContext =
  createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [organization, setOrganization] =
    useState<Organization | null>(null);

  const [status, setStatus] =
    useState<OrganizationStatus>("loading");

  const [error, setError] =
    useState<string | null>(null);

  const [reloadVersion, setReloadVersion] = useState(0);

  const reloadOrganization = useCallback(() => {
    setReloadVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setStatus("loading");
    setError(null);

    fetchOrganization(controller.signal)
      .then((nextOrganization) => {
        setOrganization(nextOrganization);
        setStatus("ready");
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        setOrganization(null);
        setStatus("error");
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the organization.",
        );
      });

    return () => {
      controller.abort();
    };
  }, [reloadVersion]);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organization,
      status,
      error,
      reloadOrganization,
    }),
    [
      error,
      organization,
      reloadOrganization,
      status,
    ],
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
