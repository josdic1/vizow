import type { Job } from "@vizow/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchJobs } from "../api/jobs";
import { useOrganization } from "./OrganizationContext";

type ActiveJobStatus =
  | "loading"
  | "ready"
  | "error";

type ActiveJobContextValue = {
  jobs: Job[];
  activeJob: Job | null;
  activeJobId: string | null;
  status: ActiveJobStatus;
  error: string | null;
  selectActiveJob: (jobId: string) => void;
  clearActiveJob: () => void;
  reloadJobs: () => void;
};

const ActiveJobContext =
  createContext<ActiveJobContextValue | null>(null);

function getStorageKey(organizationId: string): string {
  return `vizow.activeJobId.${organizationId}`;
}

function readStoredJobId(organizationId: string): string | null {
  try {
    return window.localStorage.getItem(
      getStorageKey(organizationId),
    );
  } catch {
    return null;
  }
}

function writeStoredJobId(
  organizationId: string,
  jobId: string | null,
): void {
  try {
    const key = getStorageKey(organizationId);

    if (jobId) {
      window.localStorage.setItem(key, jobId);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Job selection still works for this browser session.
  }
}

export function ActiveJobProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    organization,
    status: organizationStatus,
  } = useOrganization();

  const organizationId = organization?.id ?? null;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] =
    useState<string | null>(null);

  const [status, setStatus] =
    useState<ActiveJobStatus>("loading");

  const [error, setError] =
    useState<string | null>(null);

  const [reloadVersion, setReloadVersion] = useState(0);

  const reloadJobs = useCallback(() => {
    setReloadVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (organizationStatus === "loading") {
      setStatus("loading");
      return;
    }

    if (
      organizationStatus === "error" ||
      !organizationId
    ) {
      setJobs([]);
      setActiveJobId(null);
      setStatus("error");
      setError(
        "The organization must load before jobs can be loaded.",
      );
      return;
    }

    const controller = new AbortController();
    const storedJobId = readStoredJobId(organizationId);

    setStatus("loading");
    setError(null);

    fetchJobs(controller.signal)
      .then((nextJobs) => {
        const storedJobExists =
          storedJobId !== null &&
          nextJobs.some((job) => job.id === storedJobId);

        setJobs(nextJobs);

        if (storedJobExists) {
          setActiveJobId(storedJobId);
        } else {
          setActiveJobId(null);
          writeStoredJobId(organizationId, null);
        }

        setStatus("ready");
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        setJobs([]);
        setActiveJobId(null);
        setStatus("error");
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load jobs.",
        );
      });

    return () => {
      controller.abort();
    };
  }, [
    organizationId,
    organizationStatus,
    reloadVersion,
  ]);

  const activeJob = useMemo(
    () =>
      jobs.find((job) => job.id === activeJobId) ??
      null,
    [activeJobId, jobs],
  );

  const selectActiveJob = useCallback(
    (jobId: string) => {
      if (
        !organizationId ||
        !jobs.some((job) => job.id === jobId)
      ) {
        return;
      }

      setActiveJobId(jobId);
      writeStoredJobId(organizationId, jobId);
    },
    [jobs, organizationId],
  );

  const clearActiveJob = useCallback(() => {
    setActiveJobId(null);

    if (organizationId) {
      writeStoredJobId(organizationId, null);
    }
  }, [organizationId]);

  const value = useMemo<ActiveJobContextValue>(
    () => ({
      jobs,
      activeJob,
      activeJobId,
      status,
      error,
      selectActiveJob,
      clearActiveJob,
      reloadJobs,
    }),
    [
      activeJob,
      activeJobId,
      clearActiveJob,
      error,
      jobs,
      reloadJobs,
      selectActiveJob,
      status,
    ],
  );

  return (
    <ActiveJobContext.Provider value={value}>
      {children}
    </ActiveJobContext.Provider>
  );
}

export function useActiveJob(): ActiveJobContextValue {
  const context = useContext(ActiveJobContext);

  if (!context) {
    throw new Error(
      "useActiveJob must be used inside ActiveJobProvider.",
    );
  }

  return context;
}
