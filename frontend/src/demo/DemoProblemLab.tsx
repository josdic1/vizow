import { BookOpen, Calculator, Camera, CheckCircle2, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Job, JobJourneyEvent } from "@vizow/shared";
import { JourneyLine } from "../components/JourneyLine";
import type { DemoIssueId } from "./DemoContext";
import { getDemoIssue } from "./demoIssues";
import type { DemoIssue } from "./demoIssues";

const mediaPhotos = [
  "/sample-projects/door-alignment/A-1.png",
  "/sample-projects/door-alignment/B-1.png",
  "/sample-projects/door-alignment/D-1.png",
  "/sample-projects/door-alignment/D-2.png",
];

function money(value: string) {
  return Number.parseFloat(value) || 0;
}

function DemoInvoicePaper({ labor = 420, materials = 86.4, adjustment = 45, compact = false }: { labor?: number; materials?: number; adjustment?: number; compact?: boolean }) {
  const subtotal = labor + materials + adjustment;
  return (
    <div className={`demo-invoice-paper${compact ? " is-compact" : ""}`}>
      <header className="demo-invoice-paper-head">
        <div><strong>VIZOW</strong><span>WORK INVOICE</span></div>
        <div><b>INVOICE</b><span>#VZ-0826-041</span></div>
      </header>
      <div className="demo-invoice-parties">
        <div><span>BILL TO</span><strong>Eli Collins</strong><p>28 Ridgefield Avenue<br />West Orange, NJ</p></div>
        <div><span>JOB</span><strong>Dining room dimmer replacement</strong><p>Completed Aug 13, 2026<br />Cycle 1</p></div>
      </div>
      <div className="demo-invoice-lines">
        <div className="is-head"><span>Description</span><span>Amount</span></div>
        <div><span>Labor · dimmer replacement</span><strong>${labor.toFixed(2)}</strong></div>
        <div><span>Materials · switch, plate, connectors</span><strong>${materials.toFixed(2)}</strong></div>
        <div><span>Approved change · additional box repair</span><strong>${adjustment.toFixed(2)}</strong></div>
      </div>
      <div className="demo-invoice-paper-total"><span>TOTAL DUE</span><strong>${subtotal.toFixed(2)}</strong></div>
      <footer><span>Scope change approval and Job evidence remain attached to the record.</span><b>VIZOW · VISUAL OF WORK</b></footer>
    </div>
  );
}

function DemoAfterSnapshot({ issueId }: { issueId: DemoIssueId }) {
  if (issueId === "correspondence") {
    return (
      <div className="demo-after-snapshot demo-after-calendar">
        <div className="demo-after-title"><span>CALENDAR</span><strong>Public availability</strong><b>ON</b></div>
        <div className="demo-after-week">
          {[11, 12, 13, 14, 15, 16, 17].map((day) => <div key={day} className={day === 13 ? "limited" : day === 16 ? "off" : "open"}><span>AUG</span><strong>{day}</strong><small>{day === 13 ? "Limited" : day === 16 ? "Unavailable" : "Available"}</small></div>)}
        </div>
        <div className="demo-after-callout"><span>CLIENT VIEW</span><strong>“Tuesday or Thursday works for me.”</strong><small>Preferred date arrives with the Request. Private schedule stays private.</small></div>
      </div>
    );
  }

  if (issueId === "history") {
    return (
      <div className="demo-after-snapshot demo-after-history">
        <div className="demo-after-title"><span>CLIENT</span><strong>Eli Collins</strong><b>3 JOBS</b></div>
        <div className="demo-after-property">28 Ridgefield Avenue · West Orange, NJ</div>
        <div className="demo-after-rows">
          <div><span>ACTIVE</span><strong>Dining room dimmer buzzing</strong><small>Visit scheduled · 3 photos</small></div>
          <div><span>COMPLETE</span><strong>Loose stair handrail</strong><small>VOW · Invoice · 5 photos</small></div>
          <div><span>COMPLETE</span><strong>Bedroom door alignment</strong><small>VOW · Invoice · 8 photos</small></div>
        </div>
      </div>
    );
  }

  if (issueId === "marketing") {
    return (
      <div className="demo-after-snapshot demo-after-media">
        <div className="demo-after-title"><span>MEDIA LIBRARY</span><strong>Door alignment</strong><b>4 SELECTED</b></div>
        <div className="demo-after-media-grid">{mediaPhotos.map((src, index) => <div key={src}><img src={src} alt="" /><span>{index === 0 ? "BEFORE" : index === 1 ? "DURING" : "AFTER"}</span></div>)}</div>
        <div className="demo-after-output-row"><span>SOCIAL POST</span><span>WORK SAMPLE</span><span>MARKETING PDF</span></div>
      </div>
    );
  }

  if (issueId === "record") {
    return (
      <div className="demo-after-snapshot demo-after-record">
        <div className="demo-after-title"><span>JOB JOURNEY</span><strong>Bedroom door alignment</strong><b>CYCLE 1 · COMPLETE</b></div>
        <div className="demo-after-route" aria-hidden="true">
          <svg className="demo-after-route-svg" viewBox="0 0 760 250" role="img">
            <path className="route-trunk" d="M62 102 H698" />
            <path className="route-branch" d="M382 102 V174 H505" />

            <g className="route-stop" transform="translate(62 102)">
              <circle r="15" />
              <text className="route-label" x="0" y="42">REQUEST</text>
              <text className="route-date" x="0" y="59">AUG 10</text>
            </g>
            <g className="route-stop" transform="translate(222 102)">
              <circle r="15" />
              <text className="route-label" x="0" y="42">JOB CREATED</text>
              <text className="route-date" x="0" y="59">AUG 10</text>
            </g>
            <g className="route-stop" transform="translate(382 102)">
              <circle r="15" />
              <text className="route-label" x="0" y="42">VISIT 1</text>
              <text className="route-date" x="0" y="59">AUG 11</text>
            </g>
            <g className="route-stop" transform="translate(542 102)">
              <circle r="15" />
              <text className="route-label" x="0" y="42">VISIT 2</text>
              <text className="route-date" x="0" y="59">AUG 13</text>
            </g>
            <g className="route-stop is-current" transform="translate(698 102)">
              <circle r="15" />
              <circle className="route-current-ring" r="24" />
              <text className="route-label" x="0" y="42">CLOSED</text>
              <text className="route-date" x="0" y="59">AUG 13</text>
            </g>

            <g className="route-change" transform="translate(505 174)">
              <circle r="12" />
              <text className="route-change-label" x="24" y="-3">REV 1 · APPROVED</text>
              <text className="route-change-meta" x="24" y="16">JAMB REPAIR · +$45</text>
            </g>
          </svg>
        </div>
        <div className="demo-after-record-footer"><span>JOB JOURNEY</span><strong>Navigate the Job</strong><span>→</span><span>VOW</span><strong>Open the complete visual record</strong></div>
      </div>
    );
  }

  if (issueId === "field") {
    return (
      <div className="demo-after-snapshot demo-after-field">
        <div className="demo-after-phone">
          <header><span>FIELD MODE</span><strong>Door alignment</strong></header>
          <div><button>ADD PHOTO<small>Before · During · After</small></button><button>QUICK NOTE<small>Attached to this Job</small></button><button>CALCULATOR<small>Built-in trade tools</small></button><button className="primary">FINISH VISIT<small>One obvious action</small></button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-after-snapshot demo-after-invoice">
      <DemoInvoicePaper compact />
    </div>
  );
}

function DemoComparison({ issue }: { issue: DemoIssue }) {
  const [split, setSplit] = useState(50);
  return (
    <figure className="demo-comparison">
      <div className="demo-comparison-stage">
        <img className="demo-comparison-before" src={issue.beforeImage} alt={issue.beforeAlt} />
        <div className="demo-comparison-after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}><DemoAfterSnapshot issueId={issue.id} /></div>
        <span className="demo-comparison-label is-before">BEFORE</span>
        <span className="demo-comparison-label is-after">WITH VIZOW</span>
        <div className="demo-comparison-divider" style={{ left: `${split}%` }} aria-hidden="true"><span>↔</span></div>
        <input className="demo-comparison-range" type="range" min="8" max="92" value={split} aria-label={`Compare before and with Vizow for ${issue.short}`} onChange={(event) => setSplit(Number(event.currentTarget.value))} />
      </div>
      <figcaption>
        <div><span>BEFORE</span><p>{issue.before}</p></div>
        <div><span>WITH VIZOW</span><p>{issue.after}</p></div>
      </figcaption>
    </figure>
  );
}

function DemoCalendar({ onComplete }: { onComplete: () => void }) {
  const [publicOn, setPublicOn] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, "available" | "limited" | "unavailable">>({ 13: "limited", 16: "unavailable" });
  const days = [11, 12, 13, 14, 15, 16, 17];

  function cycleDay(day: number) {
    setOverrides((current) => {
      const status = current[day] ?? "available";
      const next = status === "available" ? "limited" : status === "limited" ? "unavailable" : "available";
      return { ...current, [day]: next };
    });
  }

  return (
    <div className="demo-lab-stack">
      <div className="demo-split-head"><div><p className="eyebrow">Contractor calendar</p><h3>Change what the client can see.</h3></div><button className={`demo-switch${publicOn ? " is-on" : ""}`} type="button" onClick={() => setPublicOn((value) => !value)}>Public {publicOn ? "ON" : "OFF"}</button></div>
      <div className="demo-calendar-grid" aria-label="Demo contractor availability">{days.map((day) => { const status = overrides[day] ?? "available"; return <button key={day} className={`demo-calendar-day status-${status}`} type="button" onClick={() => cycleDay(day)}><strong>{day}</strong><span>{status}</span></button>; })}</div>
      <div className="demo-client-preview">
        <div className="demo-split-head"><div><p className="eyebrow">Client sees</p><h3>Availability, not your private schedule.</h3></div><span className="demo-safe-badge">No client names · no Job details</span></div>
        {!publicOn ? <div className="demo-empty-note">Public availability is off.</div> : <div className="demo-calendar-grid client-grid">{days.map((day) => { const status = overrides[day] ?? "available"; const disabled = status === "unavailable"; return <button key={day} className={`demo-calendar-day status-${status}${selectedDay === day ? " is-selected" : ""}`} disabled={disabled} type="button" onClick={() => { setSelectedDay(day); onComplete(); }}><strong>{day}</strong><span>{disabled ? "Unavailable" : status === "limited" ? "Limited" : "Available"}</span></button>; })}</div>}
        {selectedDay ? <div className="demo-success-line">Preferred date recorded: August {selectedDay}. No scheduling call required.</div> : null}
      </div>
    </div>
  );
}

function DemoMedia({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState<number[]>([0, 2]);
  const [output, setOutput] = useState<"social" | "sample" | "pdf">("social");
  const [generated, setGenerated] = useState(false);

  function toggle(index: number) {
    setGenerated(false);
    setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  }

  return (
    <div className="demo-lab-stack">
      <div className="demo-split-head"><div><p className="eyebrow">Media Library</p><h3>Select the evidence. Do not hunt for files.</h3></div><strong>{selected.length} selected</strong></div>
      <div className="demo-media-grid">{mediaPhotos.map((src, index) => <button key={src} className={`demo-media-card${selected.includes(index) ? " is-selected" : ""}`} type="button" onClick={() => toggle(index)}><img src={src} alt="Door alignment demo work" /><span>{index === 0 ? "Before" : index === 1 ? "During" : "After"}</span></button>)}</div>
      <div className="demo-output-picker" role="group" aria-label="Demo output type"><button className={output === "social" ? "is-active" : ""} type="button" onClick={() => { setOutput("social"); setGenerated(false); }}>Social Post</button><button className={output === "sample" ? "is-active" : ""} type="button" onClick={() => { setOutput("sample"); setGenerated(false); }}>Work Sample</button><button className={output === "pdf" ? "is-active" : ""} type="button" onClick={() => { setOutput("pdf"); setGenerated(false); }}>Marketing PDF</button></div>
      <div className="demo-generated-output"><div><p className="eyebrow">Create from selected</p><h3>Door alignment · Montclair, NJ</h3><p>{output === "social" ? "A ready-to-edit social post built from the selected Job evidence." : output === "sample" ? "A concise Problem → Work → Result case study from the same Job." : "A polished project PDF assembled from the selected Job evidence."}</p></div><button className="btn btn-primary" disabled={selected.length === 0} type="button" onClick={() => { setGenerated(true); onComplete(); }}>Build {output === "social" ? "Social Post" : output === "sample" ? "Work Sample" : "Marketing PDF"}</button></div>
      {generated ? <div className={`demo-output-preview is-${output}`}><div className="demo-output-preview-photos">{selected.slice(0, 3).map((index) => <img key={mediaPhotos[index]} src={mediaPhotos[index]} alt="" />)}</div><div><span>VIZOW · DOOR ALIGNMENT</span><strong>{output === "social" ? "Small fix. Clean finish. Documented." : output === "sample" ? "Problem → Work → Result" : "PROJECT RECORD · MONCLAIR, NJ"}</strong><p>Generated from the Job's selected evidence, not from a separate marketing folder.</p></div></div> : null}
    </div>
  );
}

function DemoInvoice({ onComplete }: { onComplete: () => void }) {
  const [labor, setLabor] = useState("420");
  const [materials, setMaterials] = useState("86.40");
  const [adjustment, setAdjustment] = useState("45");
  const [generated, setGenerated] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const laborValue = money(labor);
  const materialsValue = money(materials);
  const adjustmentValue = money(adjustment);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const { downloadDemoInvoicePdf } = await import("../pdf/demo-invoice-pdf");
      await downloadDemoInvoicePdf({ labor: laborValue, materials: materialsValue, adjustment: adjustmentValue });
      onComplete();
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="demo-invoice-workspace">
      <div className="demo-invoice-controls">
        <div className="demo-vow-mini"><p className="eyebrow">Completed Job</p><h3>Dining room dimmer replacement</h3><div className="demo-vow-meta"><span>Client <strong>Eli Collins</strong></span><span>Cycle <strong>1 · Completed</strong></span><span>Evidence <strong>6 photos</strong></span></div></div>
        <div className="demo-scope-card demo-scope-card-compact"><div><p className="eyebrow">Approved change already attached</p><h3>Additional box repair</h3><p>Approved during the visit. The original scope remains in history.</p></div><strong>+$45</strong></div>
        <div className="demo-invoice-grid"><label>Labor<input value={labor} onChange={(event) => { setLabor(event.target.value); setGenerated(false); }} inputMode="decimal" /></label><label>Materials<input value={materials} onChange={(event) => { setMaterials(event.target.value); setGenerated(false); }} inputMode="decimal" /></label><label>Approved change<input value={adjustment} onChange={(event) => { setAdjustment(event.target.value); setGenerated(false); }} inputMode="decimal" /></label></div>
        <div className="cluster"><button className="btn btn-primary" type="button" onClick={() => { setGenerated(true); onComplete(); }}>Generate Invoice</button><button className="btn" type="button" disabled={!generated || pdfBusy} onClick={() => void downloadPdf()}>{pdfBusy ? "Building PDF…" : "Download PDF"}</button></div>
        <p className="demo-invoice-note">The invoice is a formatted output of the Job record. The approved change is already part of the history; you are not retyping the story of the Job.</p>
      </div>
      <div className={`demo-invoice-preview-shell${generated ? " is-generated" : ""}`}><div className="demo-preview-ribbon">{generated ? "READY TO SEND" : "LIVE PREVIEW"}</div><DemoInvoicePaper labor={laborValue} materials={materialsValue} adjustment={adjustmentValue} /></div>
    </div>
  );
}

const clientJobs = [
  { title: "Dining room dimmer buzzing", date: "Aug 2026", status: "Active", detail: "Request → Cycle 1 → Visit scheduled" },
  { title: "Loose stair handrail", date: "Mar 2026", status: "Completed", detail: "Cycle 1 · 5 photos · VOW available" },
  { title: "Bedroom door alignment", date: "Nov 2025", status: "Completed", detail: "Cycle 1 · 8 photos · Invoice $365" },
];

function DemoHistory({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return <div className="demo-lab-stack"><div className="demo-client-record-head"><div><p className="eyebrow">Client record</p><h3>Eli Collins</h3><p>28 Ridgefield Avenue · West Orange, NJ</p></div><div><strong>3 Jobs</strong><span>1 property</span></div></div><div className="demo-history-list">{clientJobs.map((job, index) => <button key={job.title} className={open === index ? "is-open" : ""} type="button" onClick={() => { setOpen(open === index ? null : index); onComplete(); }}><span><strong>{job.title}</strong><small>{job.date}</small></span><span><b>{job.status}</b>{open === index ? <small>{job.detail}</small> : null}</span></button>)}</div>{open !== null ? <div className="demo-history-detail"><p className="eyebrow">One click deeper</p><strong>{clientJobs[open].detail}</strong><p>The Job, cycles, media, notes, visits, invoice, and VOW stay connected to this client.</p></div> : null}</div>;
}

const demoCalculators = [
  "Board feet",
  "Concrete volume",
  "Stud count",
  "Roofing squares",
  "Paint coverage",
  "Drywall sheets",
  "Stair risers",
  "Rafter length",
  "Markup / margin",
  "Tape fraction",
];

function DemoField({ onComplete }: { onComplete: () => void }) {
  const [panel, setPanel] = useState<"home" | "note" | "resources" | "calculators">("home");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(false);

  function capturePhoto() {
    setPhotoCaptured(true);
    onComplete();
  }

  return (
    <div className="demo-field-wrap">
      <div className="demo-phone demo-field-phone">
        <div className="demo-phone-top"><span>FIELD MODE</span><strong>Door alignment</strong></div>
        {panel === "home" ? (
          <div className="demo-fat-actions demo-field-actions">
            <button type="button" onClick={() => setPanel("note")}><strong>QUICK NOTE</strong><span>Record it while you're here</span></button>
            <button type="button" onClick={() => setPanel("calculators")}><strong>CALCULATORS</strong><span>10 trade calculators</span></button>
            <button className={photoCaptured ? "has-photo" : ""} type="button" onClick={capturePhoto}>
              {photoCaptured ? <img src="/sample-projects/door-alignment/A-1.png" alt="Demo photo attached to Door alignment Job" /> : <Camera aria-hidden="true" />}
              <strong>{photoCaptured ? "PHOTO ADDED" : "ADD PHOTO"}</strong>
              <span>{photoCaptured ? "Before · attached to Door alignment" : "Fake capture · assigned to this Job"}</span>
            </button>
            <button type="button" onClick={() => setPanel("resources")}><strong>RESOURCES</strong><span>Calc · Convert · Glossary</span></button>
            <button className="is-primary demo-finish-visit" type="button" onClick={onComplete}><CheckCircle2 aria-hidden="true" /><strong>FINISH VISIT</strong><span>One obvious action</span></button>
          </div>
        ) : panel === "note" ? (
          <div className="demo-phone-panel">
            <button className="demo-back" type="button" onClick={() => setPanel("home")}>← Back</button>
            <label>Quick note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Door rubbing at top hinge…" /></label>
            <button className="btn btn-primary" type="button" onClick={() => { setSaved(true); onComplete(); }}>Save Note</button>
            {saved ? <small>Saved to this Job's history.</small> : null}
          </div>
        ) : panel === "resources" ? (
          <div className="demo-phone-panel demo-resource-panel">
            <button className="demo-back" type="button" onClick={() => setPanel("home")}>← Back</button>
            <div><p className="eyebrow">NAILED-IT</p><h3>Resources</h3><p>Jobsite references without leaving Field Mode.</p></div>
            <div className="demo-resource-grid">
              <button type="button" onClick={() => setPanel("calculators")}><Calculator aria-hidden="true" /><strong>CALC</strong><span>10 calculators</span></button>
              <div><RefreshCw aria-hidden="true" /><strong>CONVERT</strong><span>Common trade units</span></div>
              <div><BookOpen aria-hidden="true" /><strong>GLOSSARY</strong><span>Trade terms</span></div>
            </div>
          </div>
        ) : (
          <div className="demo-phone-panel demo-calculator-menu">
            <button className="demo-back" type="button" onClick={() => setPanel("home")}>← Back</button>
            <div><p className="eyebrow">NAILED-IT · CALC</p><h3>Calculators</h3><p>These are the tools available. No need to run one in the demo.</p></div>
            <div className="demo-field-calc-grid">
              {demoCalculators.map((name) => <div key={name}><Calculator aria-hidden="true" strokeWidth={1.4} /><span>{name}</span></div>)}
            </div>
          </div>
        )}
      </div>
      <div className="demo-field-explainer">
        <p className="eyebrow">Why this exists</p>
        <h3>The office system does not belong on the jobsite.</h3>
        <p>Field Mode keeps the current Job, giant actions, camera, notes and jobsite resources in one reduced surface.</p>
        <div className="demo-field-rule"><span>01</span><strong>Current Job stays visible</strong></div>
        <div className="demo-field-rule"><span>02</span><strong>Photo capture attaches directly to the Job</strong></div>
        <div className="demo-field-rule"><span>03</span><strong>Calc, Convert and Glossary stay inside Field Mode</strong></div>
        <div className="demo-field-rule"><span>04</span><strong>All 10 calculators are available without app switching</strong></div>
      </div>
    </div>
  );
}

const demoJourneyJob = {
  id: "demo-job-door-alignment",
  clientId: "demo-client-eli",
  clientName: "Eli Collins",
  title: "Bedroom door alignment",
  description: "Bedroom door rubbing at top hinge and jamb.",
  serviceAddressLine1: "28 Ridgefield Avenue",
  serviceAddressLine2: null,
  serviceCity: "West Orange",
  serviceState: "NJ",
  servicePostalCode: "07052",
  lifecycleStatus: "completed",
  cancelledAt: null,
  cancellationReason: null,
  archivedAt: null,
  createdAt: "2026-08-10T13:30:00.000Z",
  updatedAt: "2026-08-13T18:20:00.000Z",
  currentCycle: {
    id: "demo-cycle-1",
    cycleNumber: 1,
    reason: "initial",
    stage: "completed",
    openedAt: "2026-08-10T13:30:00.000Z",
    completedAt: "2026-08-13T18:20:00.000Z",
    createdAt: "2026-08-10T13:30:00.000Z",
    updatedAt: "2026-08-13T18:20:00.000Z",
  },
} as unknown as Job;

const demoJourneyEvents = [
  { id: "demo-e1", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "job_created", details: {}, createdAt: "2026-08-10T13:30:00.000Z" },
  { id: "demo-e2", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "visit_scheduled", details: { visitId: "demo-v1", visit: { status: "scheduled", scheduledStart: "2026-08-11T14:00:00.000Z", notes: "Inspect hinge and jamb alignment." } }, createdAt: "2026-08-10T15:00:00.000Z" },
  { id: "demo-e3", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "photo_uploaded", details: { photo: { stage: "before", caption: "Door rubbing at top hinge." } }, createdAt: "2026-08-11T14:06:00.000Z" },
  { id: "demo-e4", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "visit_completed", details: { visitId: "demo-v1", visit: { status: "completed", scheduledStart: "2026-08-11T14:00:00.000Z", notes: "Hinge reset; jamb movement discovered." } }, createdAt: "2026-08-11T15:10:00.000Z" },
  { id: "demo-e5", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "scope_revision_created", details: { scopeRevision: { revisionNumber: 1, priceChange: 45, reason: "Top jamb also shifted", scopeText: "Repair jamb and re-square door", visitRequirement: "required" } }, createdAt: "2026-08-11T15:16:00.000Z" },
  { id: "demo-e6", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "visit_scheduled", details: { visitId: "demo-v2", visit: { status: "scheduled", scheduledStart: "2026-08-13T16:00:00.000Z", notes: "Complete approved jamb repair." } }, createdAt: "2026-08-11T15:22:00.000Z" },
  { id: "demo-e7", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "photo_uploaded", details: { photo: { stage: "during", caption: "Jamb reset in progress." } }, createdAt: "2026-08-13T16:25:00.000Z" },
  { id: "demo-e8", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "visit_completed", details: { visitId: "demo-v2", visit: { status: "completed", scheduledStart: "2026-08-13T16:00:00.000Z", notes: "Door aligned and closing cleanly." } }, createdAt: "2026-08-13T17:15:00.000Z" },
  { id: "demo-e9", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "photo_uploaded", details: { photo: { stage: "after", caption: "Finished alignment." } }, createdAt: "2026-08-13T17:18:00.000Z" },
  { id: "demo-e10", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "cycle_closed", details: { closure: { completionDate: "2026-08-13T18:00:00.000Z", finalPrice: 365, notes: "Door aligned, jamb repaired, final operation verified." } }, createdAt: "2026-08-13T18:00:00.000Z" },
  { id: "demo-e11", jobId: "demo-job-door-alignment", jobCycleId: "demo-cycle-1", eventType: "vow_created", details: { vow: { title: "Bedroom door alignment · Visual of Work", status: "complete" } }, createdAt: "2026-08-13T18:05:00.000Z" },
] as unknown as JobJourneyEvent[];

function DemoRecord({ onComplete }: { onComplete: () => void }) {
  const [showVow, setShowVow] = useState(false);
  return (
    <div className="demo-lab-stack demo-record-lab">
      <div className="demo-vow-title"><div><p className="eyebrow">Job Journey</p><h3>The actual transit map.</h3><p>Click a stop to inspect what was recorded there.</p></div><span>Cycle 1 · Completed</span></div>
      <div className="demo-journey-live" onClick={onComplete}><JourneyLine events={demoJourneyEvents} job={demoJourneyJob} /></div>
      <div className="demo-record-distinction">
        <div><span>JOB JOURNEY</span><strong>Navigation through what happened.</strong></div>
        <span className="demo-record-arrow">→</span>
        <div><span>VOW</span><strong>The complete visual record of the Job.</strong></div>
        <button type="button" onClick={() => { setShowVow((value) => !value); onComplete(); }}>{showVow ? "Close VOW summary" : "Open VOW summary"}</button>
      </div>
      {showVow ? <div className="demo-history-detail"><p className="eyebrow">Visual of Work</p><strong>Client · property · cycles · visits · notes · scope · media · dates · outputs</strong><p>The transit map is Job Journey. The VOW is the complete visual Job record. They are connected, but they are not the same thing.</p></div> : null}
    </div>
  );
}

export function DemoProblemLab({ issueId, completed, onComplete }: { issueId: DemoIssueId; completed: boolean; onComplete: () => void }) {
  const issue = getDemoIssue(issueId);
  const [showFix, setShowFix] = useState(false);
  const fixId = `demo-fix-${issue.id}`;
  let interactive = <DemoCalendar onComplete={onComplete} />;
  if (issueId === "marketing") interactive = <DemoMedia onComplete={onComplete} />;
  if (issueId === "invoices") interactive = <DemoInvoice onComplete={onComplete} />;
  if (issueId === "history") interactive = <DemoHistory onComplete={onComplete} />;
  if (issueId === "field") interactive = <DemoField onComplete={onComplete} />;
  if (issueId === "record") interactive = <DemoRecord onComplete={onComplete} />;

  function openFix() {
    setShowFix(true);
    window.setTimeout(() => document.getElementById(fixId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  }

  return (
    <section className="demo-problem-lab" aria-labelledby={`demo-issue-${issue.id}`}>
      <header className="demo-problem-head"><div><p className="eyebrow">The annoyance · {issue.short}</p><h2 id={`demo-issue-${issue.id}`}>{issue.label}</h2></div><button className={`demo-complete-chip${completed ? " is-complete" : ""}`} type="button" onClick={openFix}>{completed ? "✓ Tried · open again" : "Try the fix ↓"}</button></header>
      <DemoComparison issue={issue} />
      <div className="demo-fix-bridge"><div><span>THE CHANGE</span><p>Drag the comparison first. Then open the small live demo only if you want to try the workflow yourself.</p></div><button type="button" onClick={openFix}>{issue.tryLabel} ↓</button></div>
      {showFix ? <div id={fixId} className="demo-interactive-zone"><div className="demo-interactive-head"><div><p className="eyebrow">Use the fix</p><h3>{issue.tryLabel}</h3></div><div className="demo-interactive-head-actions"><span>Demo-only · nothing is saved</span><button type="button" onClick={() => setShowFix(false)}>Close</button></div></div><div className="demo-interactive-shell">{interactive}</div></div> : null}
    </section>
  );
}
