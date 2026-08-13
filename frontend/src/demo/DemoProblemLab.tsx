import { useMemo, useState } from "react";
import { NailedItCalculators } from "../components/NailedItCalculators";
import type { DemoIssueId } from "./DemoContext";
import { getDemoIssue } from "./demoIssues";

function DemoCalendar({ onComplete }: { onComplete: () => void }) {
  const [publicOn, setPublicOn] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, "available" | "limited" | "unavailable">>({
    14: "limited",
    17: "unavailable",
  });

  const days = Array.from({ length: 14 }, (_, index) => index + 10);

  function cycleDay(day: number) {
    setOverrides((current) => {
      const status = current[day] ?? "available";
      const next = status === "available" ? "limited" : status === "limited" ? "unavailable" : "available";
      return { ...current, [day]: next };
    });
  }

  return (
    <div className="demo-lab-stack">
      <div className="demo-split-head">
        <div>
          <p className="eyebrow">Contractor view</p>
          <h3>Publish availability once</h3>
        </div>
        <button className={`demo-switch${publicOn ? " is-on" : ""}`} type="button" onClick={() => setPublicOn((value) => !value)}>
          Public {publicOn ? "ON" : "OFF"}
        </button>
      </div>
      <div className="demo-calendar-grid" aria-label="Demo contractor availability">
        {days.map((day) => {
          const status = overrides[day] ?? (day % 6 === 0 ? "limited" : "available");
          return (
            <button key={day} className={`demo-calendar-day status-${status}`} type="button" onClick={() => cycleDay(day)}>
              <strong>{day}</strong><span>{status}</span>
            </button>
          );
        })}
      </div>

      <div className="demo-client-preview">
        <div className="demo-split-head">
          <div><p className="eyebrow">Client view</p><h3>Pick a preferred day</h3></div>
          <span className="demo-safe-badge">Private Job details hidden</span>
        </div>
        {!publicOn ? <div className="demo-empty-note">Public availability is currently off.</div> : (
          <div className="demo-calendar-grid client-grid">
            {days.map((day) => {
              const status = overrides[day] ?? (day % 6 === 0 ? "limited" : "available");
              const disabled = status === "unavailable";
              return (
                <button
                  key={day}
                  className={`demo-calendar-day status-${status}${selectedDay === day ? " is-selected" : ""}`}
                  disabled={disabled}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    onComplete();
                  }}
                >
                  <strong>{day}</strong><span>{disabled ? "Unavailable" : status === "limited" ? "Limited" : "Available"}</span>
                </button>
              );
            })}
          </div>
        )}
        {selectedDay ? <div className="demo-success-line">Preferred date recorded: August {selectedDay}. No phone tag.</div> : null}
      </div>
    </div>
  );
}

const mediaPhotos = [
  "/sample-projects/door-alignment/A-1.png",
  "/sample-projects/door-alignment/B-1.png",
  "/sample-projects/door-alignment/D-1.png",
  "/sample-projects/door-alignment/D-2.png",
];

function downloadText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function DemoMedia({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState<number[]>([0, 2]);
  const [output, setOutput] = useState<"social" | "sample" | "pdf">("social");

  function toggle(index: number) {
    setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  }

  return (
    <div className="demo-lab-stack">
      <div className="demo-split-head"><div><p className="eyebrow">Media Library</p><h3>Select the work worth reusing</h3></div><strong>{selected.length} selected</strong></div>
      <div className="demo-media-grid">
        {mediaPhotos.map((src, index) => (
          <button key={src} className={`demo-media-card${selected.includes(index) ? " is-selected" : ""}`} type="button" onClick={() => toggle(index)}>
            <img src={src} alt="Door alignment demo work" />
            <span>{index < 1 ? "Before" : index < 2 ? "During" : "After"}</span>
          </button>
        ))}
      </div>
      <div className="demo-output-picker" role="group" aria-label="Demo output type">
        <button className={output === "social" ? "is-active" : ""} type="button" onClick={() => setOutput("social")}>Social Post</button>
        <button className={output === "sample" ? "is-active" : ""} type="button" onClick={() => setOutput("sample")}>Work Sample</button>
        <button className={output === "pdf" ? "is-active" : ""} type="button" onClick={() => setOutput("pdf")}>Marketing PDF</button>
      </div>
      <div className="demo-generated-output">
        <div>
          <p className="eyebrow">Generated from selected Job media</p>
          <h3>Door alignment · Montclair, NJ</h3>
          <p>{output === "social" ? "A clean before/after repair recap ready for a social caption." : output === "sample" ? "Problem → Work → Result, backed by Job evidence." : "A polished project sheet assembled from the same source media."}</p>
        </div>
        <button className="btn btn-primary" disabled={selected.length === 0} type="button" onClick={() => {
          downloadText(`vizow-demo-${output}.txt`, `VIZOW DEMO\nDoor alignment\nOutput: ${output}\nSelected photos: ${selected.length}\nGenerated from demo-only Job media.`);
          onComplete();
        }}>Download Demo Output</button>
      </div>
    </div>
  );
}

function DemoInvoice({ onComplete }: { onComplete: () => void }) {
  const [labor, setLabor] = useState("420");
  const [materials, setMaterials] = useState("86.40");
  const [adjustment, setAdjustment] = useState("45");
  const [generated, setGenerated] = useState(false);
  const total = [labor, materials, adjustment].reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0);

  return (
    <div className="demo-lab-stack">
      <div className="demo-vow-mini">
        <p className="eyebrow">Completed Job → VOW</p>
        <h3>Dining room dimmer replacement</h3>
        <div className="demo-vow-meta"><span>Client <strong>Eli Collins</strong></span><span>Cycle <strong>1 · Completed</strong></span><span>Evidence <strong>6 photos</strong></span></div>
      </div>
      <div className="demo-invoice-grid">
        <label>Labor<input value={labor} onChange={(event) => setLabor(event.target.value)} inputMode="decimal" /></label>
        <label>Materials<input value={materials} onChange={(event) => setMaterials(event.target.value)} inputMode="decimal" /></label>
        <label>Approved scope change<input value={adjustment} onChange={(event) => setAdjustment(event.target.value)} inputMode="decimal" /></label>
        <div className="demo-invoice-total"><span>Total</span><strong>${total.toFixed(2)}</strong></div>
      </div>
      <div className="cluster">
        <button className="btn btn-primary" type="button" onClick={() => { setGenerated(true); onComplete(); }}>Generate Invoice</button>
        {generated ? <button className="btn" type="button" onClick={() => downloadText("vizow-demo-invoice.txt", `VIZOW DEMO INVOICE\nDining room dimmer replacement\nLabor: $${labor}\nMaterials: $${materials}\nScope change: $${adjustment}\nTOTAL: $${total.toFixed(2)}`)}>Download Invoice</button> : null}
      </div>
      {generated ? <div className="demo-success-line">Invoice created from the completed Job record—not reconstructed from memory.</div> : null}
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
  return (
    <div className="demo-lab-stack">
      <div className="demo-client-record-head"><div><p className="eyebrow">Client record</p><h3>Eli Collins</h3><p>28 Ridgefield Avenue · West Orange, NJ</p></div><div><strong>3 Jobs</strong><span>1 property</span></div></div>
      <div className="demo-history-list">
        {clientJobs.map((job, index) => (
          <button key={job.title} className={open === index ? "is-open" : ""} type="button" onClick={() => { setOpen(open === index ? null : index); onComplete(); }}>
            <span><strong>{job.title}</strong><small>{job.date}</small></span>
            <span><b>{job.status}</b>{open === index ? <small>{job.detail}</small> : null}</span>
          </button>
        ))}
      </div>
      {open !== null ? <div className="demo-history-detail"><p className="eyebrow">Job history</p><strong>{clientJobs[open].detail}</strong><p>Open the Job, its cycles, media, notes, visits, and VOW from one client record.</p></div> : null}
    </div>
  );
}

function DemoField({ onComplete }: { onComplete: () => void }) {
  const [panel, setPanel] = useState<"home" | "note" | "calc">("home");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <div className="demo-field-wrap">
      <div className="demo-phone">
        <div className="demo-phone-top"><span>FIELD MODE</span><strong>Door alignment</strong></div>
        {panel === "home" ? (
          <div className="demo-fat-actions">
            <button type="button" onClick={() => setPanel("note")}><strong>QUICK NOTE</strong><span>One thumb</span></button>
            <button type="button" onClick={() => { setPanel("calc"); onComplete(); }}><strong>CALCULATOR</strong><span>No app switching</span></button>
            <button type="button" onClick={() => onComplete()}><strong>ADD PHOTO</strong><span>Before / During / After</span></button>
            <button className="is-primary" type="button" onClick={() => onComplete()}><strong>FINISH VISIT</strong><span>Record it now</span></button>
          </div>
        ) : panel === "note" ? (
          <div className="demo-phone-panel"><button className="demo-back" type="button" onClick={() => setPanel("home")}>← Back</button><label>Quick note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Door rubbing at top hinge…" /></label><button className="btn btn-primary" type="button" onClick={() => { setSaved(true); onComplete(); }}>Save Note</button>{saved ? <small>Saved to this Job's history.</small> : null}</div>
        ) : (
          <div className="demo-phone-panel demo-phone-calc"><button className="demo-back" type="button" onClick={() => setPanel("home")}>← Back</button><p className="eyebrow">Built-in tool</p><strong>Markup / margin and trade calculators stay inside Field Mode.</strong></div>
        )}
      </div>
      <div className="demo-field-calculator"><NailedItCalculators /></div>
    </div>
  );
}

function DemoScope({ onComplete }: { onComplete: () => void }) {
  const [decision, setDecision] = useState<"pending" | "approved" | "declined">("pending");
  return (
    <div className="demo-lab-stack">
      <div className="demo-scope-card"><div><p className="eyebrow">Scope revision 02</p><h3>Replace damaged jamb section</h3><p>Discovered during visit. Additional material and 45 minutes labor.</p></div><strong>+$185</strong></div>
      <div className="demo-scope-links"><span>Cycle 1</span><span>Visit Aug 12</span><span>Price change +$185</span><span>Decision {decision}</span></div>
      <div className="cluster"><button className="btn btn-primary" type="button" onClick={() => { setDecision("approved"); onComplete(); }}>Approve Revision</button><button className="btn" type="button" onClick={() => setDecision("declined")}>Decline</button></div>
      {decision !== "pending" ? <div className="demo-success-line">Decision recorded as a Job event. The original scope remains in history.</div> : null}
    </div>
  );
}

const vowEvents = ["Request received", "Job created", "Visit completed", "Scope revision approved", "Before / during / after evidence", "Cycle completed", "Invoice generated"];
function DemoRecord({ onComplete }: { onComplete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="demo-lab-stack">
      <div className="demo-vow-title"><div><p className="eyebrow">Visual of Work</p><h3>One Job. One record.</h3></div><span>Cycle 1 · Completed</span></div>
      <div className="demo-vow-timeline">{vowEvents.map((event, index) => <button key={event} type="button" onClick={() => { setExpanded(true); onComplete(); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{event}</strong></button>)}</div>
      {expanded ? <div className="demo-history-detail"><p className="eyebrow">Evidence stays connected</p><strong>Client · property · cycles · visits · notes · scope · media · dates · outputs</strong><p>The VOW is the living visual record of the entire Job, across every cycle.</p></div> : null}
    </div>
  );
}

export function DemoProblemLab({ issueId, completed, onComplete }: { issueId: DemoIssueId; completed: boolean; onComplete: () => void }) {
  const issue = getDemoIssue(issueId);
  const interactive = useMemo(() => {
    switch (issueId) {
      case "correspondence": return <DemoCalendar onComplete={onComplete} />;
      case "marketing": return <DemoMedia onComplete={onComplete} />;
      case "invoices": return <DemoInvoice onComplete={onComplete} />;
      case "history": return <DemoHistory onComplete={onComplete} />;
      case "field": return <DemoField onComplete={onComplete} />;
      case "scope": return <DemoScope onComplete={onComplete} />;
      case "record": return <DemoRecord onComplete={onComplete} />;
    }
  }, [issueId, onComplete]);

  return (
    <section className="demo-problem-lab" aria-labelledby={`demo-issue-${issue.id}`}>
      <header className="demo-problem-head">
        <div><p className="eyebrow">Before / After · {issue.comparisonLabel}</p><h2 id={`demo-issue-${issue.id}`}>{issue.label}</h2></div>
        <span className={`demo-complete-chip${completed ? " is-complete" : ""}`}>{completed ? "✓ Tried" : "Try the fix"}</span>
      </header>

      <div className="demo-before-after-copy">
        <div><span>Before</span><p>{issue.before}</p></div>
        <div><span>With Vizow</span><p>{issue.after}</p></div>
      </div>

      <div className="demo-ba-viewport">
        <iframe src={issue.comparisonSrc} title={`${issue.comparisonLabel} before and after comparison`} loading="lazy" />
      </div>

      <div className="demo-interactive-head"><p className="eyebrow">Now use it</p><h3>This part is live, demo-only, and non-persistent.</h3></div>
      <div className="demo-interactive-shell">{interactive}</div>
    </section>
  );
}
