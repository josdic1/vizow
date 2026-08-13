import { useMemo, useState, type ReactNode } from "react";
import {
  DemoContext,
  type DemoIssueId,
  type DemoView,
} from "./DemoContext";

const STORAGE_KEY = "vizow.demo.completed.v2";

function readCompleted(): DemoIssueId[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<DemoView>("problems");
  const [activeIssue, setActiveIssue] = useState<DemoIssueId>("correspondence");
  const [completedIssues, setCompletedIssues] = useState<DemoIssueId[]>(readCompleted);

  const value = useMemo(
    () => ({
      view,
      activeIssue,
      completedIssues,
      setView,
      openIssue: (issue: DemoIssueId) => {
        setActiveIssue(issue);
        setView("problems");
      },
      completeIssue: (issue: DemoIssueId) => {
        setCompletedIssues((current) => {
          if (current.includes(issue)) return current;
          const next = [...current, issue];
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      },
      reset: () => {
        setView("problems");
        setActiveIssue("correspondence");
        setCompletedIssues([]);
        window.localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [activeIssue, completedIssues, view],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
