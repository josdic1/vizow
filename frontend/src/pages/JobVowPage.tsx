import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Check, Copy, Download, Mail, MessageSquareText, Share2 } from "lucide-react";
import type {
  Job,
  JobJourneyEvent,
  Media,
  ScopeRevision,
  Visit,
} from "@vizow/shared";

import {
  fetchJob,
  fetchJobJourney,
  fetchJobPhotos,
  fetchScopeRevisions,
  fetchVisits,
} from "../api/jobs";
import { AppLayout } from "../layouts/AppLayout";

type OutputMode =
  | "full"
  | "social"
  | "marketing-email"
  | "customer-update"
  | "customer-request"
  | "marketing"
  | "one-sheet"
  | "work-sample"
  | "invoice";

type VowPageState =
  | { status: "loading" }
  | {
      status: "ready";
      job: Job;
      events: JobJourneyEvent[];
      media: Media[];
      revisions: ScopeRevision[];
      visits: Visit[];
    }
  | { status: "error"; message: string };

const outputOptions: Array<{ mode: OutputMode; label: string }> = [
  { mode: "full", label: "VOW" },
  { mode: "social", label: "Social Post" },
  { mode: "marketing-email", label: "Marketing Email" },
  { mode: "customer-update", label: "Customer Update" },
  { mode: "customer-request", label: "Customer Request" },
  { mode: "marketing", label: "Marketing PDF" },
  { mode: "one-sheet", label: "One Sheet" },
  { mode: "work-sample", label: "Work Sample" },
  { mode: "invoice", label: "Invoice" },
];

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: number | null): string {
  if (value === null) return "Not recorded";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatAddress(job: Job): string {
  return [
    [job.serviceAddressLine1, job.serviceAddressLine2].filter(Boolean).join(", "),
    [job.serviceCity, job.serviceState, job.servicePostalCode]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ") || "No service address recorded";
}

function formatPublicLocation(job: Job): string {
  return [job.serviceCity, job.serviceState].filter(Boolean).join(", ") || "Project location";
}

function statusLabel(job: Job): string {
  if (job.archivedAt) return "Archived";
  if (job.lifecycleStatus === "cancelled") return "Cancelled";
  return job.currentCycle.stage === "completed" ? "Completed" : "Active";
}

function clientFirstName(job: Job): string {
  return job.clientName.trim().split(/\s+/)[0] || job.clientName;
}

function scopeSummary(job: Job): string {
  return job.description?.trim() || "The work is documented in the Visual of Work.";
}

function socialCaption(job: Job): string {
  return `${job.title} · ${formatPublicLocation(job)}\n\n${scopeSummary(job)}\n\nBefore, during, and after documented in Vizow.`;
}

function marketingEmailCopy(job: Job, photoCount: number, cycles: number): { subject: string; body: string } {
  return {
    subject: `Recent project: ${job.title} in ${formatPublicLocation(job)}`,
    body: `We recently documented ${job.title.toLowerCase()} in ${formatPublicLocation(job)}.\n\n${scopeSummary(job)}\n\nThe project record includes ${photoCount} photo${photoCount === 1 ? "" : "s"} across ${cycles} cycle${cycles === 1 ? "" : "s"}, from the initial condition through the current result.\n\nReply if you would like us to take a look at something similar.`,
  };
}

function customerUpdateCopy(job: Job, photoCount: number): { subject: string; body: string } {
  return {
    subject: `Update: ${job.title}`,
    body: `Hi ${clientFirstName(job)},\n\nHere’s the latest on ${job.title} at ${formatAddress(job)}.\n\n${scopeSummary(job)}\n\nCurrent status: ${statusLabel(job)} · Cycle ${job.currentCycle.cycleNumber}. The work record currently includes ${photoCount} photo${photoCount === 1 ? "" : "s"}.\n\nLet me know if you have any questions.`,
  };
}

function customerRequestCopy(job: Job): { subject: string; body: string } {
  const requestLine = statusLabel(job) === "Completed"
    ? "Please review the completed work and let me know if anything needs attention."
    : "Please review the current work record and reply to confirm the next step or let me know what you would like changed.";
  return {
    subject: `Please review: ${job.title}`,
    body: `Hi ${clientFirstName(job)},\n\n${requestLine}\n\n${scopeSummary(job)}\n\nProperty: ${formatAddress(job)}\nCurrent position: Cycle ${job.currentCycle.cycleNumber} · ${statusLabel(job)}.`,
  };
}

function eventTitle(event: JobJourneyEvent): string {
  const details = record(event.details);
  const revision = record(details?.scopeRevision);
  const cycleNumber = numberValue(details?.cycleNumber);
  const revisionNumber = numberValue(revision?.revisionNumber) ?? numberValue(details?.revisionNumber);
  const stage = text(record(details?.photo)?.stage) ?? text(details?.stage);

  switch (event.eventType) {
    case "job_created":
      return "Job created";
    case "cycle_reopened":
      return cycleNumber ? `Cycle ${cycleNumber} opened` : "Cycle reopened";
    case "cycle_closed":
      return cycleNumber ? `Cycle ${cycleNumber} completed` : "Cycle completed";
    case "visit_scheduled":
      return "Visit scheduled";
    case "visit_completed":
      return "Visit completed";
    case "visit_cancelled":
      return "Visit cancelled";
    case "field_note_created":
      return "Field note";
    case "photo_uploaded":
      return `${stage ? stage[0].toUpperCase() + stage.slice(1) : "Job"} photo`;
    case "scope_revision_created":
      return revisionNumber ? `Scope revision ${revisionNumber}` : "Scope revision";
    case "scope_revision_visit_linked":
      return "Scope change linked to visit";
    case "job_cancelled":
      return "Job cancelled";
    case "job_archived":
      return "Job archived";
    default:
      return event.eventType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

function eventBody(event: JobJourneyEvent): string | null {
  const details = record(event.details);
  const fieldNote = record(details?.fieldNote);
  const photo = record(details?.photo);
  const visit = record(details?.visit);
  const revision = record(details?.scopeRevision);
  const closure = record(details?.closure);

  return (
    text(fieldNote?.content) ??
    text(revision?.scopeText) ??
    text(visit?.notes) ??
    text(photo?.caption) ??
    text(closure?.notes) ??
    text(details?.message) ??
    text(details?.reason) ??
    text(details?.cancellationReason)
  );
}

function eventPhoto(event: JobJourneyEvent): string | null {
  const details = record(event.details);
  return text(record(details?.photo)?.url);
}

function eventFinalPrice(event: JobJourneyEvent): number | null {
  const details = record(event.details);
  return numberValue(record(details?.closure)?.finalPrice) ?? numberValue(details?.finalPrice);
}

function eventCompletionDate(event: JobJourneyEvent): string | null {
  const details = record(event.details);
  return text(record(details?.closure)?.completionDate) ??
    (event.eventType === "cycle_closed" ? event.createdAt : null);
}

function mediaTime(media: Media): number {
  return new Date(media.capturedAt ?? media.createdAt).getTime();
}

function cycleNumberMap(
  job: Job,
  events: JobJourneyEvent[],
  visits: Visit[],
): Map<string, number> {
  const map = new Map<string, number>();
  map.set(job.currentCycle.id, job.currentCycle.cycleNumber);

  for (const visit of visits) map.set(visit.jobCycleId, visit.cycleNumber);

  for (const event of events) {
    if (!event.jobCycleId) continue;
    const details = record(event.details);
    const direct = numberValue(details?.cycleNumber);
    if (direct) map.set(event.jobCycleId, direct);
  }

  return map;
}

export function JobVowPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [outputMode, setOutputMode] = useState<OutputMode>("full");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [state, setState] = useState<VowPageState>(
    jobId
      ? { status: "loading" }
      : { status: "error", message: "The Job ID is missing." },
  );

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();

    Promise.all([
      fetchJob(jobId, controller.signal),
      fetchJobJourney(jobId, controller.signal),
      fetchJobPhotos(jobId, controller.signal),
      fetchScopeRevisions(jobId, controller.signal),
      fetchVisits(jobId, controller.signal),
    ])
      .then(([job, events, media, revisions, visits]) => {
        setState({ status: "ready", job, events, media, revisions, visits });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load this Visual of Work.",
        });
      });

    return () => controller.abort();
  }, [jobId]);

  const job = state.status === "ready" ? state.job : null;

  const view = useMemo(() => {
    if (state.status !== "ready") return null;

    const chronologicalMedia = [...state.media].sort((a, b) => mediaTime(a) - mediaTime(b));

    const before =
      chronologicalMedia.find((item) => item.stage === "before") ??
      chronologicalMedia[0] ??
      null;
    const after =
      [...chronologicalMedia].reverse().find((item) => item.stage === "after") ??
      chronologicalMedia.at(-1) ??
      null;
    const visibleEvents = state.events.filter((event) => event.eventType !== "vow_created");
    const closures = visibleEvents.filter((event) => event.eventType === "cycle_closed");
    const lastClosure = closures.at(-1) ?? null;
    const finalPrice = lastClosure ? eventFinalPrice(lastClosure) : null;
    const completionDate = lastClosure ? eventCompletionDate(lastClosure) : null;
    const cycleMap = cycleNumberMap(state.job, state.events, state.visits);
    const cycleNumbers = new Set<number>([state.job.currentCycle.cycleNumber]);
    for (const value of cycleMap.values()) cycleNumbers.add(value);

    const mediaByStage = {
      before: chronologicalMedia.filter((item) => item.stage === "before"),
      during: chronologicalMedia.filter((item) => item.stage === "during"),
      after: chronologicalMedia.filter((item) => item.stage === "after"),
    };

    return {
      chronologicalMedia,
      before,
      after,
      visibleEvents,
      finalPrice,
      completionDate,
      cycleMap,
      cycleNumbers: [...cycleNumbers].sort((a, b) => a - b),
      mediaByStage,
    };
  }, [state]);

  async function downloadPdf(): Promise<void> {
    if (state.status !== "ready" || !view || pdfBusy) return;

    setPdfBusy(true);
    try {
      const { createVowPdfBlob, pdfFileName } = await import("../pdf/vow-pdf");
      const blob = await createVowPdfBlob({
        mode: outputMode,
        job: state.job,
        events: view.visibleEvents,
        media: view.chronologicalMedia,
        revisions: state.revisions,
        visits: state.visits,
        cycleNumbers: view.cycleNumbers,
        cycleMap: view.cycleMap,
        finalPrice: view.finalPrice,
        completionDate: view.completionDate,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = pdfFileName(state.job, outputMode);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <AppLayout
      object={job?.title ?? "Visual of Work"}
      tool="VOW"
      action="Create from VOW"
      result={
        state.status === "ready"
          ? "Ready"
          : state.status === "error"
            ? "Not loaded"
            : "Loading"
      }
      message="One immutable Visual of Work. Social, marketing, customer, and billing outputs are generated from it without changing the VOW."
      activeStep={state.status === "ready" ? "action" : "result"}
      resultTone={state.status === "error" ? "error" : state.status === "loading" ? "working" : "success"}
      sections={[
        { id: "vow-outputs", label: "Create" },
        ...(outputMode === "full" ? [{ id: "vow-record", label: "VOW" }] : []),
      ]}
    >
      <main className="live-vow-page page">
        {state.status === "loading" && <div className="notice">Loading Visual of Work…</div>}
        {state.status === "error" && <div className="notice notice-error">{state.message}</div>}

        {state.status === "ready" && view && (
          <div className={`live-vow-shell live-vow-mode-${outputMode}`}>
            <div className="live-vow-controls no-print" id="vow-outputs">
              <div className="live-vow-control-copy">
                <p className="eyebrow">Create from VOW</p>
                <p className="live-vow-create-note">Choose an output. The living VOW stays unchanged.</p>
              </div>
              <label className="live-vow-output-picker">
                <span>Output</span>
                <select
                  aria-label="VOW output view"
                  value={outputMode}
                  onChange={(event) => setOutputMode(event.target.value as OutputMode)}
                >
                  {outputOptions.map((option) => (
                    <option key={option.mode} value={option.mode}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div className="live-vow-control-actions">
                <Link className="btn" to={`/app/jobs/${state.job.id}`}>← Job</Link>
                {(["full", "marketing", "one-sheet", "work-sample", "invoice"] as OutputMode[]).includes(outputMode) && (
                  <button className="btn btn-primary" type="button" onClick={() => void downloadPdf()} disabled={pdfBusy}>
                    <Download aria-hidden="true" /> {pdfBusy ? "Building PDF…" : "Download PDF"}
                  </button>
                )}
              </div>
            </div>

            {outputMode === "full" && (
              <article className="live-vow-document live-vow-full-document" id="vow-record">
                <FullVowHeader job={state.job} />
                <FullVowOverview
                  job={state.job}
                  cycles={view.cycleNumbers.length}
                  events={view.visibleEvents.length}
                  revisions={state.revisions.length}
                  visits={state.visits.length}
                  photos={state.media.length}
                  before={view.before}
                  after={view.after}
                  completionDate={view.completionDate}
                  finalPrice={view.finalPrice}
                />
                <BeforeAfter before={view.before} after={view.after} />

                <section className="live-vow-section live-vow-timeline-section">
                  <SectionHeading eyebrow="Job record" title="Project Timeline" meta={`${view.visibleEvents.length} ${view.visibleEvents.length === 1 ? "event" : "events"}`} />
                  <div className={`live-vow-timeline${view.visibleEvents.length === 1 ? " is-single" : ""}`}>
                    {view.visibleEvents.map((event) => (
                      <TimelineEvent key={event.id} event={event} cycleNumber={event.jobCycleId ? view.cycleMap.get(event.jobCycleId) : undefined} />
                    ))}
                  </div>
                </section>

                {state.revisions.length > 0 && (
                  <section className="live-vow-section">
                    <SectionHeading eyebrow="Changes" title="Scope Revisions" meta={`${state.revisions.length} revisions`} />
                    <div className="live-vow-ledger">
                      {state.revisions.map((revision) => (
                        <div className="live-vow-ledger-row" key={revision.id}>
                          <div className="live-vow-ledger-number">
                            {String(revision.revisionNumber).padStart(2, "0")}
                            <span>Cycle {view.cycleMap.get(revision.jobCycleId) ?? "—"}</span>
                          </div>
                          <div>
                            <strong>{revision.scopeText}</strong>
                            {revision.reason && <p>{revision.reason}</p>}
                          </div>
                          <b>{revision.priceChange === 0 ? "No price change" : formatMoney(revision.priceChange)}</b>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {state.visits.length > 0 && (
                  <section className="live-vow-section">
                    <SectionHeading eyebrow="Field work" title="Visits" meta={`${state.visits.length} visits`} />
                    <div className="live-vow-visit-list">
                      {state.visits.map((visit) => (
                        <article key={visit.id}>
                          <span>Cycle {visit.cycleNumber}</span>
                          <strong>{formatDateTime(visit.scheduledStart)}</strong>
                          <b>{visit.status}</b>
                          {visit.notes && <p>{visit.notes}</p>}
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {state.media.length > 0 && (
                  <PhotoRecord mediaByStage={view.mediaByStage} cycleMap={view.cycleMap} />
                )}
              </article>
            )}

            {outputMode === "marketing-email" && (
              <GeneratedCopyOutput
                key="marketing-email"
                kind="email"
                eyebrow="Marketing"
                title="Marketing Email"
                {...marketingEmailCopy(state.job, state.media.length, view.cycleNumbers.length)}
              />
            )}

            {outputMode === "customer-update" && (
              <GeneratedCopyOutput
                key="customer-update"
                kind="message"
                eyebrow="Customer"
                title="Customer Update"
                {...customerUpdateCopy(state.job, state.media.length)}
              />
            )}

            {outputMode === "customer-request" && (
              <GeneratedCopyOutput
                key="customer-request"
                kind="request"
                eyebrow="Customer"
                title="Customer Request"
                {...customerRequestCopy(state.job)}
              />
            )}

            {outputMode === "invoice" && (
              <article className="live-vow-document live-vow-invoice">
                <VowHeader job={state.job} outputLabel="Bill / Invoice View" />
                <section className="live-vow-invoice-summary">
                  <div><span>Bill to</span><strong>{state.job.clientName}</strong><p>{formatAddress(state.job)}</p></div>
                  <div><span>Job</span><strong>{state.job.title}</strong><p>{state.job.description ?? "No approved scope recorded."}</p></div>
                </section>
                <section className="live-vow-section">
                  <SectionHeading eyebrow="Documented charges" title="Scope & Adjustments" />
                  <div className="live-vow-invoice-table">
                    <div className="head"><span>Description</span><span>Amount</span></div>
                    <div><span>Approved job scope</span><span>Included in job total</span></div>
                    {state.revisions.map((revision) => (
                      <div key={revision.id}><span>Revision {revision.revisionNumber}: {revision.scopeText}</span><span>{formatMoney(revision.priceChange)}</span></div>
                    ))}
                    <div className="total"><strong>Recorded final total</strong><strong>{formatMoney(view.finalPrice)}</strong></div>
                  </div>
                  {view.finalPrice === null && <p className="live-vow-data-note">No final price is recorded yet. Vizow does not invent billing data.</p>}
                </section>
              </article>
            )}

            {outputMode === "marketing" && (
              <article className="live-vow-document live-vow-marketing">
                <VowHeader job={state.job} outputLabel="Marketing Project Story" hideClient />
                <BeforeAfter before={view.before} after={view.after} />
                <section className="live-vow-section live-vow-marketing-copy">
                  <p className="eyebrow">Project</p>
                  <h2>{state.job.title}</h2>
                  <p>{state.job.description ?? "Documented work completed with a full visual record."}</p>
                  <div className="live-vow-stat-strip">
                    <div><span>Cycles</span><strong>{view.cycleNumbers.length}</strong></div>
                    <div><span>Photos</span><strong>{view.chronologicalMedia.length}</strong></div>
                    <div><span>Status</span><strong>{statusLabel(state.job)}</strong></div>
                  </div>
                </section>
                <PhotoGrid media={view.chronologicalMedia.slice(0, 6)} />
              </article>
            )}

            {outputMode === "one-sheet" && (
              <article className="live-vow-document live-vow-one-sheet">
                <VowHeader job={state.job} outputLabel="Project One Sheet" />
                <section className="live-vow-one-sheet-grid">
                  <div>
                    <p className="eyebrow">Approved scope</p>
                    <h2>{state.job.title}</h2>
                    <p>{state.job.description ?? "No approved scope recorded."}</p>
                    <dl>
                      <div><dt>Client</dt><dd>{state.job.clientName}</dd></div>
                      <div><dt>Location</dt><dd>{formatAddress(state.job)}</dd></div>
                      <div><dt>Cycles</dt><dd>{view.cycleNumbers.length}</dd></div>
                      <div><dt>Status</dt><dd>{statusLabel(state.job)}</dd></div>
                    </dl>
                  </div>
                  <BeforeAfter before={view.before} after={view.after} compact />
                </section>
              </article>
            )}

            {outputMode === "social" && (
              <div className="live-vow-social-output">
                <article className="live-vow-social-card">
                  <div className="live-vow-social-images">
                    {view.before && <img src={view.before.url} alt="Before" />}
                    {view.after && <img src={view.after.url} alt="After" />}
                  </div>
                  <div className="live-vow-social-top"><strong>VIZOW</strong><span>Before → After</span></div>
                  <div className="live-vow-social-bottom">
                    <p className="eyebrow">{formatPublicLocation(state.job)}</p>
                    <h2>{state.job.title}</h2>
                    <div><span>{view.chronologicalMedia.length} photos</span><span>{view.cycleNumbers.length} cycle{view.cycleNumbers.length === 1 ? "" : "s"}</span><span>{statusLabel(state.job)}</span></div>
                  </div>
                </article>
                <GeneratedCopyOutput
                  key="social-caption"
                  kind="social"
                  eyebrow="Social"
                  title="Post Copy"
                  body={socialCaption(state.job)}
                />
              </div>
            )}

            {outputMode === "work-sample" && (
              <article className="live-vow-document live-vow-work-sample">
                <VowHeader job={state.job} outputLabel="Work Sample" hideClient />
                <section className="live-vow-section">
                  <p className="eyebrow">Project summary</p>
                  <h2>{state.job.title}</h2>
                  <p>{state.job.description ?? "No approved scope recorded."}</p>
                  <p className="live-vow-public-location">{formatPublicLocation(state.job)}</p>
                </section>
                <BeforeAfter before={view.before} after={view.after} />
                <PhotoGrid media={view.chronologicalMedia.slice(0, 9)} />
              </article>
            )}
          </div>
        )}
      </main>
    </AppLayout>
  );
}

function GeneratedCopyOutput({
  kind,
  eyebrow,
  title,
  subject,
  body,
}: {
  kind: "social" | "email" | "message" | "request";
  eyebrow: string;
  title: string;
  subject?: string;
  body: string;
}) {
  const [draftSubject, setDraftSubject] = useState(subject ?? "");
  const [draftBody, setDraftBody] = useState(body);
  const [copied, setCopied] = useState(false);

  const Icon = kind === "social"
    ? Share2
    : kind === "email"
      ? Mail
      : MessageSquareText;

  async function copyDraft(): Promise<void> {
    const value = draftSubject.trim()
      ? `Subject: ${draftSubject.trim()}\n\n${draftBody}`
      : draftBody;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <article className="live-vow-copy-output">
      <header>
        <div className="live-vow-copy-icon"><Icon aria-hidden="true" /></div>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>Drafted from the VOW. Edit it here without changing the Job record.</p>
        </div>
      </header>

      {subject !== undefined && (
        <label className="live-vow-copy-field">
          <span>Subject</span>
          <input value={draftSubject} onChange={(event) => setDraftSubject(event.currentTarget.value)} />
        </label>
      )}

      <label className="live-vow-copy-field">
        <span>{kind === "social" ? "Post" : "Message"}</span>
        <textarea rows={12} value={draftBody} onChange={(event) => setDraftBody(event.currentTarget.value)} />
      </label>

      <div className="live-vow-copy-actions no-print">
        <button className="btn btn-primary" type="button" onClick={() => void copyDraft()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy draft"}
        </button>
      </div>
    </article>
  );
}

function FullVowHeader({ job }: { job: Job }) {
  return (
    <header className="live-vow-full-header">
      <div className="live-vow-full-heading">
        <div className="live-vow-full-kicker">
          <strong>VIZOW</strong>
          <span>Visual of Work</span>
        </div>
        <p className="eyebrow">Full visual of work</p>
        <h1>{job.title}</h1>
        <p className="live-vow-full-location">{job.clientName} · {formatAddress(job)}</p>
      </div>
      <div className="live-vow-full-status">
        <strong>{statusLabel(job)}</strong>
        <span>Cycle {job.currentCycle.cycleNumber}</span>
      </div>
    </header>
  );
}

function FullVowOverview({
  job,
  cycles,
  events,
  revisions,
  visits,
  photos,
  before,
  after,
  completionDate,
  finalPrice,
}: {
  job: Job;
  cycles: number;
  events: number;
  revisions: number;
  visits: number;
  photos: number;
  before: Media | null;
  after: Media | null;
  completionDate: string | null;
  finalPrice: number | null;
}) {
  const evidenceLabel = before && after ? "Before + after captured" : photos > 0 ? "Photo evidence started" : "No photo evidence yet";
  const outcomeLabel = completionDate ? `Completed ${formatDate(completionDate)}` : statusLabel(job);

  return (
    <section className="live-vow-full-overview" aria-label="VOW record summary">
      <div>
        <span>Record</span>
        <strong>{cycles} {cycles === 1 ? "cycle" : "cycles"}</strong>
        <small>{events} timeline {events === 1 ? "event" : "events"}</small>
      </div>
      <div>
        <span>Field work</span>
        <strong>{visits} {visits === 1 ? "visit" : "visits"}</strong>
        <small>{revisions} scope {revisions === 1 ? "revision" : "revisions"}</small>
      </div>
      <div>
        <span>Evidence</span>
        <strong>{photos} {photos === 1 ? "photo" : "photos"}</strong>
        <small>{evidenceLabel}</small>
      </div>
      <div>
        <span>Outcome</span>
        <strong>{outcomeLabel}</strong>
        <small>{finalPrice === null ? "Price not recorded" : formatMoney(finalPrice)}</small>
      </div>
    </section>
  );
}

function VowHeader({ job, outputLabel, hideClient = false }: { job: Job; outputLabel: string; hideClient?: boolean }) {
  return (
    <header className="live-vow-header">
      <div className="live-vow-brand"><strong>VIZOW</strong><span>Visual of Work</span></div>
      <div className="live-vow-header-copy">
        <p className="eyebrow">{outputLabel}</p>
        <h1>{job.title}</h1>
        <p>{hideClient ? formatPublicLocation(job) : `${job.clientName} · ${formatAddress(job)}`}</p>
      </div>
      <div className="live-vow-status-stamp"><strong>{statusLabel(job)}</strong><span>Cycle {job.currentCycle.cycleNumber}</span></div>
    </header>
  );
}

function SectionHeading({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return (
    <header className="live-vow-section-heading">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      {meta && <span>{meta}</span>}
    </header>
  );
}

function BeforeAfter({ before, after, compact = false }: { before: Media | null; after: Media | null; compact?: boolean }) {
  if (!before && !after) return null;
  return (
    <section className={`live-vow-before-after${compact ? " is-compact" : ""}`}>
      {!compact && <SectionHeading eyebrow="Visual proof" title="Before & After" />}
      <div className="live-vow-compare">
        <figure>{before ? <img src={before.url} alt={before.caption ?? "Before work"} /> : <div className="live-vow-image-empty">No before photo</div>}<figcaption>Before</figcaption></figure>
        <figure>{after ? <img src={after.url} alt={after.caption ?? "After work"} /> : <div className="live-vow-image-empty">No after photo</div>}<figcaption>After</figcaption></figure>
      </div>
    </section>
  );
}

function TimelineEvent({ event, cycleNumber }: { event: JobJourneyEvent; cycleNumber?: number }) {
  const photo = eventPhoto(event);
  const body = eventBody(event);
  return (
    <article className="live-vow-timeline-event">
      <div className="live-vow-timeline-dot" />
      <div className="live-vow-timeline-copy">
        <p className="live-vow-timeline-when">{formatDateTime(event.createdAt)}{cycleNumber ? ` · Cycle ${cycleNumber}` : ""}</p>
        <h3>{eventTitle(event)}</h3>
        {body && <p>{body}</p>}
      </div>
      {photo && <img src={photo} alt="" />}
    </article>
  );
}

function PhotoRecord({ mediaByStage, cycleMap }: { mediaByStage: Record<"before" | "during" | "after", Media[]>; cycleMap: Map<string, number> }) {
  return (
    <section className="live-vow-section">
      <SectionHeading eyebrow="Evidence" title="Photo Record" meta={`${mediaByStage.before.length + mediaByStage.during.length + mediaByStage.after.length} photos`} />
      {(["before", "during", "after"] as const).map((stage) => (
        <div className="live-vow-photo-stage" key={stage}>
          <h3>{stage} <span>{mediaByStage[stage].length}</span></h3>
          <PhotoGrid media={mediaByStage[stage]} cycleMap={cycleMap} />
        </div>
      ))}
    </section>
  );
}

function PhotoGrid({ media, cycleMap }: { media: Media[]; cycleMap?: Map<string, number> }) {
  if (!media.length) return <p className="live-vow-empty">No photos in this group.</p>;
  return (
    <div className="live-vow-photo-grid">
      {media.map((item) => (
        <figure key={item.id}>
          <img src={item.url} alt={item.caption ?? `${item.stage} work photo`} />
          <figcaption>
            <div className="live-vow-photo-labels">
              <strong>{item.stage}</strong>
            </div>
            <span>{cycleMap ? `Cycle ${cycleMap.get(item.jobCycleId) ?? "—"} · ` : ""}{formatDate(item.capturedAt ?? item.createdAt)}</span>
            {item.caption && <small>{item.caption}</small>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
