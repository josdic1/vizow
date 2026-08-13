import { createContext } from "react";

export type DemoView =
  | "problems"
  | "contractor"
  | "client"
  | "documentation"
  | "walkthrough";

export type DemoIssueId =
  | "correspondence"
  | "marketing"
  | "invoices"
  | "history"
  | "field"
  | "scope"
  | "record";

export type DemoContextValue = {
  view: DemoView;
  activeIssue: DemoIssueId;
  completedIssues: DemoIssueId[];
  setView: (view: DemoView) => void;
  openIssue: (issue: DemoIssueId) => void;
  completeIssue: (issue: DemoIssueId) => void;
  reset: () => void;
};

export const DemoContext = createContext<DemoContextValue | null>(null);
