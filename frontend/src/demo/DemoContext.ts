import { createContext } from "react";

export type DemoStage = "list" | "compare" | "guided";

export type DemoIssueId =
  | "correspondence"
  | "marketing"
  | "photos"
  | "notes"
  | "history"
  | "record"
  | "field"
  | "invoices";


export type DemoContextValue = {
  stage: DemoStage;
  activeIssueId: DemoIssueId;
  completedIssueIds: DemoIssueId[];
  openIssue: (issue: DemoIssueId) => void;
  showGuided: () => void;
  completeActiveIssue: () => void;
  backToList: () => void;
  reset: () => void;
};

export const DemoContext = createContext<DemoContextValue | null>(null);
