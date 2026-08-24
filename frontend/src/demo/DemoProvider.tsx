import { useMemo, useState, type ReactNode } from "react";
import {
  DemoContext,
  type DemoIssueId,
  type DemoStage,
} from "./DemoContext";
import { demoIssues } from "./demoReplacementIssues";

const STORAGE_KEY = "vizow.demo.completed.v4";
const VALID_ISSUE_IDS = new Set<DemoIssueId>(demoIssues.map((issue) => issue.id));

function isDemoIssueId(value: unknown): value is DemoIssueId {
  return typeof value === "string" && VALID_ISSUE_IDS.has(value as DemoIssueId);
}

function readCompleted(): DemoIssueId[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(isDemoIssueId))];
  } catch {
    return [];
  }
}

function scrollDemoTop() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
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
        scrollDemoTop();
      },
      showGuided: () => {
        setStage("guided");
        scrollDemoTop();
      },
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
        scrollDemoTop();
      },
      reset: () => {
        setStage("list");
        setActiveIssueId("correspondence");
        setCompletedIssueIds([]);
        window.localStorage.removeItem(STORAGE_KEY);
        scrollDemoTop();
      },
    }),
    [activeIssueId, completedIssueIds, stage],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
