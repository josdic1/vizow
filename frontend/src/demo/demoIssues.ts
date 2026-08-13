import type { DemoIssueId } from "./DemoContext";

export type DemoIssue = {
  id: DemoIssueId;
  label: string;
  short: string;
  before: string;
  after: string;
  comparisonLabel: string;
  comparisonSrc: string;
};

export const demoIssues: DemoIssue[] = [
  {
    id: "correspondence",
    label: "I keep answering scheduling questions I shouldn't have to answer",
    short: "Client correspondence",
    before: "Dates, availability, photos, and follow-up live in texts and phone calls.",
    after: "The contractor publishes availability once; the client sees the safe public view and requests a date.",
    comparisonLabel: "Messages",
    comparisonSrc: "/demo/before-after/android-messages.html",
  },
  {
    id: "marketing",
    label: "I take job photos and never use them again",
    short: "Jobs → marketing",
    before: "Good work disappears into a camera roll after the invoice is paid.",
    after: "Job media stays attached to the work and can become social, a work sample, or a marketing PDF.",
    comparisonLabel: "Photos",
    comparisonSrc: "/demo/before-after/iphone-photos.html",
  },
  {
    id: "invoices",
    label: "I can't standardize invoices from job to job",
    short: "Standard invoices",
    before: "Scope, price changes, notes, and completion details have to be reconstructed manually.",
    after: "The completed Job and VOW provide the record used to produce a consistent invoice.",
    comparisonLabel: "Tablet",
    comparisonSrc: "/demo/before-after/tablet.html",
  },
  {
    id: "history",
    label: "I can't find the complete history of an old client",
    short: "Client history",
    before: "Search means remembering which app, thread, folder, or camera roll contains the answer.",
    after: "The Client record leads directly to properties, Jobs, cycles, media, and VOWs.",
    comparisonLabel: "Search",
    comparisonSrc: "/demo/before-after/android-search.html",
  },
  {
    id: "field",
    label: "My fat fingers can't use normal software on a jobsite",
    short: "Field Mode",
    before: "Tiny controls and app switching are hostile when you're standing in dust with one hand free.",
    after: "Field Mode keeps the active Job, giant actions, notes, photos, and calculators in one jobsite screen.",
    comparisonLabel: "Notifications",
    comparisonSrc: "/demo/before-after/android-notifications.html",
  },
  {
    id: "scope",
    label: "Scope changes get buried in conversations",
    short: "Scope revisions",
    before: "A changed requirement becomes another message nobody can reliably reconcile later.",
    after: "Scope revisions are explicit Job events with price, visit, and approval context.",
    comparisonLabel: "Windows",
    comparisonSrc: "/demo/before-after/windows.html",
  },
  {
    id: "record",
    label: "I don't have one clean record of what actually happened",
    short: "Visual of Work",
    before: "The truth is fragmented across schedule, notes, images, memory, and billing.",
    after: "One Job produces one living Visual of Work across every cycle.",
    comparisonLabel: "iPad",
    comparisonSrc: "/demo/before-after/ipad.html",
  },
];

export function getDemoIssue(id: DemoIssueId): DemoIssue {
  return demoIssues.find((issue) => issue.id === id) ?? demoIssues[0];
}
