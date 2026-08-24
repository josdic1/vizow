import type { DemoIssueId } from "./DemoContext";

export type DemoIssue = {
  id: DemoIssueId;
  short: string;
  label: string;
  before: string;
  after: string;
  beforeImage: string;
  beforeAlt: string;
};

export const demoIssues: DemoIssue[] = [
  {
    id: "correspondence",
    short: "Correspondence & scheduling",
    label: "My phone never stops. Half of it I could've just sent them a link.",
    before: "Every question comes in a different way — call, text, DM, email — even the ones you already answered for the last client.",
    after: "Clients see your real availability, not your private schedule. They send a preferred day. No back-and-forth for stuff you'd rather not repeat.",
    beforeImage: "/demo/replacement/correspondence.jpg",
    beforeAlt: "A phone showing a wall of missed calls, texts, and notifications hitting at once.",
  },
  {
    id: "marketing",
    short: "Marketing & proof",
    label: "Five years of good work and nothing to show for it online.",
    before: "The work is done. The photos are scattered across camera rolls, old texts, and folders. Nobody outside the job ever sees any of it.",
    after: "The photos already live on the Job. Select the evidence and turn it into a post — caption written, ready to publish.",
    beforeImage: "/demo/replacement/marketing.jpg",
    beforeAlt: "A contractor surrounded by phones, folders, photos, invoices, notes, and unfinished marketing tasks.",
  },
  {
    id: "photos",
    short: "Photo library",
    label: "7,000+ photos on my phone and I still can't find the one I need.",
    before: "Every job's photos land in the same endless camera roll — before, after, receipts, screenshots, the dog. All of it mixed together.",
    after: "Every photo saves to its Job with the Before/During/After stage you choose. Search the Job, client, note, location, cycle, or stage — not your camera roll.",
    beforeImage: "/demo/replacement/photos.jpg",
    beforeAlt: "A phone photo gallery showing 7,352 images with no organization.",
  },
  {
    id: "notes",
    short: "Notes & scraps",
    label: "85 notes across two apps and I still can't remember what I wrote down.",
    before: "Measurements, budgets, client asks, punch lists — scattered across whatever note happened to be open when you thought of it.",
    after: "Notes attach to the Job the moment you write them. Open the Job, and every note you ever took on it is right there.",
    beforeImage: "/demo/replacement/notes.jpg",
    beforeAlt: "A phone notes app showing dozens of unrelated scattered notes.",
  },
  {
    id: "history",
    short: "Client history",
    label: "I know I did work for this client. I just can't find any of it.",
    before: "The client is in Contacts, the old Job is in a notebook, the photos are somewhere else, and the follow-up is on a sticky note.",
    after: "Open the Client once and the property, Jobs, cycles, photos, dates, and invoices are already connected.",
    beforeImage: "/demo/replacement/clients.jpg",
    beforeAlt: "A phone contact list, notebook, sticky notes, business cards, and printed job photos used to track clients.",
  },
  {
    id: "record",
    short: "Job visibility",
    label: "I know the job got done. Reconstructing exactly what happened is another story.",
    before: "The visits, changes, photos, and final outcome are scattered across files and memory. Later, rebuilding the sequence means piecing the Job back together by hand.",
    after: "One Journey shows the Job in order — request, visits, scope changes, and close — with the evidence attached to the moment it happened.",
    beforeImage: "/demo/replacement/record.jpg",
    beforeAlt: "A phone file manager showing 157 disorganized, similarly-named job files.",
  },
  {
    id: "field",
    short: "Field Mode",
    label: "The system that works at my desk falls apart on the jobsite.",
    before: "You're standing in someone's kitchen searching your phone for a formula instead of doing the work.",
    after: "Field Mode keeps the current Job, photos, notes, and every trade calculator you'd need — one tap, no searching.",
    beforeImage: "/demo/replacement/field.jpg",
    beforeAlt: "A phone browser showing a Google search history full of construction formula lookups.",
  },
  {
    id: "invoices",
    short: "Invoices & changes",
    label: "I rebuild the whole job from scraps when it's time to bill.",
    before: "When billing time comes, the price, materials, and approved changes have to be reconstructed from files, memory, or a calculator full of guesses.",
    after: "The finished Job already has the scope and approved changes on it. Review the line items and generate a real invoice.",
    beforeImage: "/demo/replacement/invoices.jpg",
    beforeAlt: "A phone calculator showing a manual, error-prone pricing formula.",
  },
];

export function getDemoIssue(id: DemoIssueId): DemoIssue {
  return demoIssues.find((issue) => issue.id === id) ?? demoIssues[0];
}
