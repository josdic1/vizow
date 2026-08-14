import { useMemo, useState, type ReactNode } from "react";
import {
  DemoContext,
  type DemoIssueId,
  type DemoStage,
} from "./DemoContext";

const STORAGE_KEY = "vizow.demo.completed.v4";

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
  const [stage, setStage] = useState<DemoStage>("list");
  const [activeIssueId, setActiveIssueId] = useState<DemoIssueId>("correspondence");
  const [completedIssueIds, setCompletedIssueIds] = useState<DemoIssueId[]>(readCompleted);

  const value = useMemo(
    () => ({
      stage,
      activeIssueId,
      completedIssueIds,
      openIssue: (issue: DemoIssueId) => {
        setActiveIssueId(issue);
        setStage("compare");
      },
      showGuided: () => setStage("guided"),
      completeActiveIssue: () => {
        setCompletedIssueIds((current) => {
          if (current.includes(activeIssueId)) return current;
          const next = [...current, activeIssueId];
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      },
      backToList: () => {
        setStage("list");
      },
      reset: () => {
        setStage("list");
        setActiveIssueId("correspondence");
        setCompletedIssueIds([]);
        window.localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [activeIssueId, completedIssueIds, stage],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
