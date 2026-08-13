import type { DemoIssueId } from "./DemoContext";

export type DemoIssue = {
  id: DemoIssueId;
  label: string;
  short: string;
  before: string;
  after: string;
  beforeImage: string;
  beforeAlt: string;
  tryLabel: string;
};

export const demoIssues: DemoIssue[] = [
  {
    id: "correspondence",
    short: "Scheduling & phone tag",
    label: "I spend half my day answering 'when can you come?'",
    before: "Calendar, texts, callbacks, sticky notes, estimates, and client questions all become separate things you have to remember to check.",
    after: "Your real schedule stays private. Clients see only safe availability and can send a preferred date without another round of phone tag.",
    beforeImage: "/demo/problems/scheduling.png",
    beforeAlt: "A contractor desk covered with calendars, phones, notes, receipts, and client paperwork.",
    tryLabel: "Set availability and pick a date",
  },
  {
    id: "history",
    short: "Client history",
    label: "I know I did work for this client. I just can't find all of it.",
    before: "The client is in Contacts, the old Job is in a notebook, the photos are somewhere else, and the follow-up is on a sticky note.",
    after: "Open the Client once and the property, Jobs, cycles, photos, dates, invoices, and VOWs are already connected.",
    beforeImage: "/demo/problems/clients.png",
    beforeAlt: "A phone contact list, notebook, sticky notes, business cards, and printed job photos used to track clients.",
    tryLabel: "Open a client's Job history",
  },
  {
    id: "marketing",
    short: "Photos → proof & marketing",
    label: "I have years of good work I can't actually use.",
    before: "The work is finished, but the proof is buried in camera rolls, folders, old texts, and whatever naming system happened that week.",
    after: "The photos already belong to the Job. Select the evidence and turn it into a social post, work sample, or marketing PDF without hunting for files.",
    beforeImage: "/demo/problems/marketing.png",
    beforeAlt: "A contractor surrounded by phones, folders, photos, invoices, notes, and unfinished marketing tasks.",
    tryLabel: "Turn Job photos into an output",
  },
  {
    id: "record",
    short: "One Job record",
    label: "Every finished job leaves behind a pile instead of a record.",
    before: "Receipts, permits, photos, notes, backups, and folders all survive the Job, but none of them is the Job record.",
    after: "One Job keeps the Request, cycles, visits, scope, notes, media, completion, invoice, and VOW connected in sequence.",
    beforeImage: "/demo/problems/job-record.jpeg",
    beforeAlt: "A contractor office desk piled with project binders, permits, receipts, job photos, backups, and notes.",
    tryLabel: "Open the complete Job record",
  },
  {
    id: "field",
    short: "Field Mode",
    label: "The system I can use at a desk falls apart on a jobsite.",
    before: "The office setup is a desktop full of files and apps. On a jobsite you need the current Job and the few actions you can actually use with one hand.",
    after: "Field Mode strips the jobsite view down to the active Job, large actions, photos, notes, visit controls, and built-in trade tools.",
    beforeImage: "/demo/problems/field-mode.jpeg",
    beforeAlt: "A Windows desktop crowded with job files, invoices, permits, photos, and application shortcuts.",
    tryLabel: "Use Field Mode",
  },
  {
    id: "invoices",
    short: "Invoices & changes",
    label: "I rebuild the job from scraps when it's time to invoice.",
    before: "When billing time comes, the price, materials, approved changes, and completed work have to be reconstructed from files and memory.",
    after: "The completed Job already contains the scope and approved changes. Review the line items, generate the invoice, and download the actual PDF.",
    beforeImage: "/demo/problems/invoicing.jpeg",
    beforeAlt: "A cluttered Windows desktop filled with invoices, permits, job notes, client photos, and project documents.",
    tryLabel: "Generate an invoice from the Job",
  },
];

export function getDemoIssue(id: DemoIssueId): DemoIssue {
  return demoIssues.find((issue) => issue.id === id) ?? demoIssues[0];
}
