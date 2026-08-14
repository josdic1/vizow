import { useEffect, useState, type ReactNode } from "react";
import { getDemoIssue } from "./demoReplacementIssues";
import { useDemo } from "./useDemo";

const TOTAL_STEPS = 3;

const PHOTO_A = "/sample-projects/door-alignment/A-1.png";
const PHOTO_B = "/sample-projects/door-alignment/B-1.png";
const PHOTO_D = "/sample-projects/door-alignment/D-1.png";

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M9 9h7M9 13h7M9 17h4" />
    </svg>
  );
}
function CalcIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M8 7h8M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1" />
    </svg>
  );
}

function SkeletonDoc({ title, photoCount, lines, total }: { title: string; photoCount: number; lines: number[]; total?: string }) {
  return (
    <div className="demo-skeleton-doc">
      <div className="demo-sk-head"><span>{title}</span><span>VOW</span></div>
      {photoCount > 0 ? (
        <div className="demo-sk-photos">
          {Array.from({ length: photoCount }).map((_, i) => <div key={i} className="demo-sk-photo" />)}
        </div>
      ) : null}
      {lines.map((w, i) => <div key={i} className="demo-sk-line" style={{ width: `${w}%` }} />)}
      {total ? <div className="demo-sk-total"><span>TOTAL DUE</span><span>{total}</span></div> : null}
    </div>
  );
}

function VowFullCard(opts: { title: string; cycle: string; client: string; property: string; visits: string; notesCount: string; changeText: string; total: string }) {
  return (
    <div className="demo-vow-full">
      <div className="demo-vow-full-head"><strong>VOW · {opts.title}</strong><span>{opts.cycle}</span></div>
      <div className="demo-vow-full-photos">
        <div><div className="demo-vow-ph" /><span>Before</span></div>
        <div><div className="demo-vow-ph" /><span>During</span></div>
        <div><div className="demo-vow-ph" /><span>After</span></div>
      </div>
      <div className="demo-vow-full-rows">
        <div><span>Client</span><span>{opts.client}</span></div>
        <div><span>Property</span><span>{opts.property}</span></div>
        <div><span>Visits</span><span>{opts.visits}</span></div>
        <div><span>Notes</span><span>{opts.notesCount}</span></div>
        <div><span>Scope change</span><span>{opts.changeText}</span></div>
        <div><span>Total</span><span>{opts.total}</span></div>
      </div>
      <p className="demo-vow-full-foot">One visual record, start to finish — nothing separate to assemble.</p>
    </div>
  );
}

const TRANSIT_STOPS = [
  { label: "REQUEST", date: "Aug 10", x: 55 },
  { label: "JOB", date: "Aug 10", x: 200 },
  { label: "VISIT 1", date: "Aug 11", x: 345 },
  { label: "VISIT 2", date: "Aug 13", x: 500 },
  { label: "CLOSED", date: "Aug 13", x: 665 },
];

function TransitMap({ activeIndex, locked, onPick }: { activeIndex: number | null; locked?: boolean; onPick: (i: number) => void }) {
  const y = 76;
  return (
    <div className="demo-transit-map" style={locked ? { opacity: 0.55, pointerEvents: "none" } : undefined}>
      <svg className="demo-transit-svg" viewBox="0 0 720 165" xmlns="http://www.w3.org/2000/svg">
        <path className="rt-trunk" d={`M55 ${y} H665`} />
        {TRANSIT_STOPS.map((s, i) => {
          const isCurrent = i === TRANSIT_STOPS.length - 1;
          const isActive = activeIndex === i;
          return (
            <g
              key={s.label}
              className={`rt-stop${isCurrent ? " is-current" : ""}${isActive ? " is-active" : ""}`}
              onClick={() => onPick(i)}
            >
              <circle cx={s.x} cy={y} r={15} />
              <text x={s.x} y={y + 38}>{s.label}</text>
              <text className="rt-date" x={s.x} y={y + 51}>{s.date}</text>
            </g>
          );
        })}
        <g className="rt-change">
          <path className="rt-branch" d={`M345 ${y} V28 H405`} />
          <circle cx={413} cy={28} r={8} />
          <text x={428} y={25} textAnchor="start">SCOPE CHANGE</text>
          <text x={428} y={38} textAnchor="start" className="rt-change-detail">+$45 · APPROVED</text>
        </g>
      </svg>
      <div className="demo-transit-legend">
        <span><i style={{ background: "var(--color-success)" }} />Complete</span>
        <span><i style={{ background: "#b5311f" }} />Current</span>
        <span><i style={{ background: "#2f5fa8" }} />Change order</span>
      </div>
    </div>
  );
}

const HISTORY_JOBS = [
  { title: "Dining room dimmer buzzing", status: "Active · visit scheduled", photoCount: 1, lines: [80, 60], total: undefined as string | undefined },
  { title: "Loose stair handrail", status: "Complete · 5 photos", photoCount: 3, lines: [70, 50, 40], total: "$210.00" },
  { title: "Bedroom door alignment", status: "Complete · invoice $365", photoCount: 3, lines: [80, 60], total: "$365.00" },
];

const STOP_DOCS: { title: string; photoCount: number; lines: number[]; total?: string }[] = [
  { title: "REQUEST · AUG 10", photoCount: 0, lines: [70, 50] },
  { title: "JOB CREATED · AUG 10", photoCount: 0, lines: [60] },
  { title: "VISIT 1 · AUG 11", photoCount: 1, lines: [80, 40] },
  { title: "VISIT 2 · AUG 13", photoCount: 2, lines: [90, 60, 50] },
  { title: "CLOSED · AUG 13", photoCount: 3, lines: [70], total: "$365.00" },
];

const CALCULATORS = ["Board feet", "Concrete", "Stud count", "Roofing sq", "Paint cvg", "Drywall", "Stair riser", "Markup"];

export function DemoGuided() {
  const { activeIssueId, backToList, completeActiveIssue } = useDemo();
  const issue = getDemoIssue(activeIssueId);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [toggleOn, setToggleOn] = useState(false);
  const [pickedPhoto, setPickedPhoto] = useState<number | null>(null);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [showData, setShowData] = useState(false);
  const [openStop, setOpenStop] = useState<number | null>(null);
  const [fieldPanel, setFieldPanel] = useState<"photo" | "note" | "calc">("photo");
  const [showVowSummary, setShowVowSummary] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  function advance() {
    setStep((v) => Math.min(TOTAL_STEPS - 1, v + 1));
  }
  function finish() {
    completeActiveIssue();
    backToList();
  }
  function pickStop(i: number) {
    setOpenStop(i);
    if (step < TOTAL_STEPS - 1) advance();
  }

  const { instruction, body } = renderStep();

  return (
    <div className="demo-guided">
      <button type="button" className="demo-back-link" onClick={backToList}>← Back to your list</button>

      <div className="demo-guided-top">
        <span>{issue.short}</span>
        <b>Step {step + 1} / {TOTAL_STEPS}</b>
        <em>{elapsed}s elapsed</em>
      </div>
      <div className="demo-guided-progress"><span style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} /></div>

      <div className="demo-guided-stage">
        <p className="demo-guided-instruction">{instruction}</p>
        <div className="demo-guided-body">{body}</div>
      </div>

      {step === TOTAL_STEPS - 1 ? (
        <div className="demo-guided-finish">
          <button type="button" className="btn btn-primary" onClick={finish}>Back to your list →</button>
        </div>
      ) : null}
    </div>
  );

  function renderStep(): { instruction: string; body: ReactNode } {
    if (activeIssueId === "correspondence") {
      if (step === 0) return {
        instruction: "This is your calendar. Right now, nobody outside your business can see it.",
        body: (
          <div className="demo-guided-row">
            <div className="demo-day-preview"><div className="dp-date">TUE AUG 18</div><div className="dp-event">9:00 — Dimmer replace (Eli)</div></div>
            <button type="button" className="btn" onClick={advance}>Got it →</button>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Turn public availability ON.",
        body: (
          <button type="button" className={`demo-switch${toggleOn ? " is-on" : ""}`} onClick={() => { setToggleOn(true); advance(); }}>
            Public availability {toggleOn ? "ON" : "OFF"}
          </button>
        ),
      };
      return {
        instruction: "Same day, two views. Booked jobs set the status automatically — you never set it by hand.",
        body: (
          <div className="demo-split-cal">
            <div>
              <div className="sc-label">You see</div>
              <div className="sc-date">Tue Aug 18</div>
              <div className="sc-event">9:00 · Dimmer replace — Eli Collins</div>
              <div className="sc-event">1:00 · Deck estimate — Nick R.</div>
              <div className="sc-note">2 booked · room for one more</div>
            </div>
            <div>
              <div className="sc-label">Client sees</div>
              <div className="sc-date">Tue Aug 18</div>
              <span className="sc-pill limited">◐ Limited</span>
              <div className="sc-note">Full day → Unavailable. No jobs → Available.</div>
            </div>
          </div>
        ),
      };
    }

    if (activeIssueId === "marketing") {
      const photos = [PHOTO_A, PHOTO_B, PHOTO_D];
      if (step === 0) return {
        instruction: "These already live on the Job.",
        body: (
          <div className="demo-guided-row">
            <div style={{ display: "flex", gap: 10 }}>
              {photos.map((p) => <img key={p} src={p} alt="" style={{ width: 64, height: 64, objectFit: "cover", border: "3px solid var(--color-ink)", opacity: 0.5 }} />)}
            </div>
            <button type="button" className="btn" onClick={advance}>Got it →</button>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Tap a photo to select it for a post.",
        body: (
          <div style={{ display: "flex", gap: 10 }}>
            {photos.map((p, i) => (
              <button key={p} type="button" style={{ border: "3px solid var(--color-ink)", padding: 0, cursor: "pointer" }} onClick={() => { setPickedPhoto(i); advance(); }}>
                <img src={p} alt="" style={{ width: 64, height: 64, objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        ),
      };
      return {
        instruction: "Generated by Vizow. Copy the caption, save the photo, post it.",
        body: (
          <div>
            <div className="demo-ig-post">
              <div className="ig-post-head"><div className="ig-post-avatar" /><strong>rugged_built_llc</strong></div>
              <img src={photos[pickedPhoto ?? 0]} alt="" />
              <div className="ig-post-actions">♡ 💬 ➤</div>
              <div className="ig-post-caption"><b>rugged_built_llc</b>Small fix. Clean finish. Documented. Door alignment — Montclair, NJ.</div>
              <div className="ig-post-cta"><span>Copy caption</span><span>Save photo</span></div>
            </div>
            <div className="demo-ig-flag">Written and built from this Job's own record — nothing typed by hand.</div>
          </div>
        ),
      };
    }

    if (activeIssueId === "photos") {
      if (step === 0) return {
        instruction: "7,352 photos. The one you need is in here somewhere.",
        body: (
          <div className="demo-guided-row">
            <div style={{ display: "flex", gap: 5 }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="demo-sk-photo" style={{ width: 44, height: 44 }} />)}</div>
            <button type="button" className="btn" onClick={advance}>Got it →</button>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Tap to open this Job's Media Library instead.",
        body: <button type="button" className="demo-tap-card" onClick={advance}>Open Media Library →</button>,
      };
      return {
        instruction: "Every photo already tagged, searchable in seconds.",
        body: (
          <div className="demo-media-mini">
            <div className="media-mini-search">🔍 door alignment</div>
            <div className="media-mini-grid">
              <div><img src={PHOTO_A} alt="" /><span>Before</span></div>
              <div><img src={PHOTO_B} alt="" /><span>During</span></div>
              <div><img src={PHOTO_D} alt="" /><span>After</span></div>
            </div>
          </div>
        ),
      };
    }

    if (activeIssueId === "notes") {
      if (step === 0) return {
        instruction: "85 notes. Somewhere in there is the measurement you need right now.",
        body: (
          <div className="demo-guided-row">
            <div className="demo-note-chaos">
              <div className="nc" style={{ top: 0, left: 0, transform: "rotate(-4deg)" }}><div className="demo-sk-line" style={{ width: "80%" }} /><div className="demo-sk-line" style={{ width: "60%" }} /></div>
              <div className="nc" style={{ top: 22, left: 44, transform: "rotate(3deg)" }}><div className="demo-sk-line" style={{ width: "60%" }} /><div className="demo-sk-line" style={{ width: "90%" }} /></div>
            </div>
            <button type="button" className="btn" onClick={advance}>Got it →</button>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Tap to attach a note to this Job.",
        body: <button type="button" className="demo-tap-card" onClick={advance}>Add Note →</button>,
      };
      return {
        instruction: "One note, attached to the Job it's about. Open the Job, find every note you took on it.",
        body: (
          <div className="demo-note-card">
            <p className="eyebrow">Bedroom door alignment</p>
            <strong>Note · Aug 11</strong>
            <p>Door rubbing at top hinge. Jamb also shifted — client approved the extra repair for Tuesday's visit.</p>
          </div>
        ),
      };
    }

    if (activeIssueId === "history") {
      if (step === 0) return {
        instruction: "This is a client record.",
        body: (
          <div className="demo-guided-row">
            <span className="demo-chip is-inert">Eli Collins · 3 Jobs</span>
            <button type="button" className="btn" onClick={advance}>Got it →</button>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Tap the client to open their job history.",
        body: <button type="button" className="demo-tap-card" onClick={advance}>Eli Collins · 3 Jobs →</button>,
      };
      return {
        instruction: "Every job, every photo, every invoice for this client — tap one open.",
        body: (
          <div style={{ width: "100%" }}>
            <div className="demo-see-data-row">
              <p>Eli Collins · 3 Jobs · 1 property</p>
              <button type="button" className="demo-see-data-btn" onClick={() => setShowData((v) => !v)}>{showData ? "Hide data" : "See data"}</button>
            </div>
            {showData ? (
              <div className="demo-data-strip">
                <div><strong>3</strong><span>Jobs</span></div>
                <div><strong>18</strong><span>Photos</span></div>
                <div><strong>$1,240</strong><span>Invoiced</span></div>
              </div>
            ) : null}
            <div className="demo-mini-list">
              {HISTORY_JOBS.map((job, i) => (
                <button key={job.title} type="button" className={openRow === i ? "is-open" : ""} onClick={() => setOpenRow(openRow === i ? null : i)}>
                  <span><strong>{job.title}</strong></span>
                  <span>{job.status}</span>
                </button>
              ))}
            </div>
            {openRow !== null ? (
              <div style={{ marginTop: 10 }}>
                <SkeletonDoc title={`VOW · ${HISTORY_JOBS[openRow].title.toUpperCase()}`} photoCount={HISTORY_JOBS[openRow].photoCount} lines={HISTORY_JOBS[openRow].lines} total={HISTORY_JOBS[openRow].total} />
              </div>
            ) : null}
          </div>
        ),
      };
    }

    if (activeIssueId === "record") {
      const stopMeta = TRANSIT_STOPS.map((s) => s.label);
      if (step === 0) return {
        instruction: "This is one job, start to finish.",
        body: (
          <div className="demo-guided-row" style={{ flexDirection: "column", gap: 14 }}>
            <div style={{ width: "100%", maxWidth: 540 }}><TransitMap activeIndex={null} locked onPick={() => {}} /></div>
            <button type="button" className="btn" onClick={advance}>Got it →</button>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Tap any stop to see what happened there.",
        body: <div style={{ width: "100%", maxWidth: 540 }}><TransitMap activeIndex={null} onPick={pickStop} /></div>,
      };
      return {
        instruction: "That's the whole job, in order, with nothing missing. Tap another stop any time.",
        body: (
          <div style={{ width: "100%", maxWidth: 540 }}>
            <TransitMap activeIndex={openStop} onPick={pickStop} />
            {openStop !== null ? (
              <div className="demo-transit-inspect">
                <div className="ti-head">Now at <b>{stopMeta[openStop]}</b> · {STOP_DOCS[openStop].title.split(" · ")[1]}</div>
                <SkeletonDoc {...STOP_DOCS[openStop]} />
              </div>
            ) : null}
            <div className="demo-journey-vow-bridge">
              <div><span>Job Journey</span>Navigation through what happened.</div>
              <span className="jvb-arrow">→</span>
              <div><span>VOW</span>The complete visual record of the Job.</div>
              <button type="button" className="btn" onClick={() => setShowVowSummary((v) => !v)}>{showVowSummary ? "Close VOW summary" : "Open VOW summary"}</button>
            </div>
            {showVowSummary ? (
              <div style={{ marginTop: 12 }}>
                <VowFullCard title="Bedroom door alignment" cycle="Cycle 1 · Complete" client="Eli Collins" property="28 Ridgefield Ave, West Orange NJ" visits="2" notesCount="3" changeText="+$45 · approved" total="$365.00" />
              </div>
            ) : null}
          </div>
        ),
      };
    }

    if (activeIssueId === "field") {
      if (step === 0) return {
        instruction: "This is Field Mode — what you see on the jobsite.",
        body: (
          <div className="demo-guided-row" style={{ flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span className="demo-field-badge">Auto-tagged · Bedroom door alignment</span>
            <div className="demo-field-icon-row">
              <div className="is-inert"><CameraIcon />PHOTO</div>
              <div className="is-inert"><NoteIcon />NOTE</div>
              <div className="is-inert"><CalcIcon />CALC</div>
            </div>
            <button type="button" className="btn" onClick={advance}>Got it →</button>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Tap Add Photo.",
        body: (
          <div className="demo-field-icon-row">
            <button type="button" onClick={advance}><CameraIcon />PHOTO</button>
            <div className="is-inert"><NoteIcon />NOTE</div>
            <div className="is-inert"><CalcIcon />CALC</div>
          </div>
        ),
      };
      return {
        instruction: "Photo, note, or calculator — every tile is one tap, tagged to this Job automatically.",
        body: (
          <div className="demo-guided-row" style={{ flexDirection: "column", alignItems: "center" }}>
            <span className="demo-field-badge">Auto-tagged · Bedroom door alignment</span>
            <div className="demo-field-icon-row">
              <button type="button" className={fieldPanel === "photo" ? "is-active" : ""} onClick={() => setFieldPanel("photo")}><CameraIcon />PHOTO</button>
              <button type="button" className={fieldPanel === "note" ? "is-active" : ""} onClick={() => setFieldPanel("note")}><NoteIcon />NOTE</button>
              <button type="button" className={fieldPanel === "calc" ? "is-active" : ""} onClick={() => setFieldPanel("calc")}><CalcIcon />CALC</button>
            </div>
            {fieldPanel === "photo" ? (
              <div className="demo-field-panel">
                <img src={PHOTO_A} alt="" style={{ width: "100%", maxWidth: 200, border: "2px solid var(--color-ink)", display: "block" }} />
                <p style={{ fontSize: ".7rem", color: "var(--color-ink-soft)", marginTop: 6 }}>Attached automatically to Bedroom door alignment.</p>
              </div>
            ) : null}
            {fieldPanel === "note" ? (
              <div className="demo-field-panel">
                <div className="demo-note-card" style={{ maxWidth: "none" }}><strong>Quick note</strong><p>Jamb also shifted — client approved the extra repair for Tuesday's visit.</p></div>
              </div>
            ) : null}
            {fieldPanel === "calc" ? (
              <div className="demo-field-panel">
                <div className="demo-calc-grid">{CALCULATORS.map((c) => <div key={c}><CalcIcon />{c}</div>)}</div>
              </div>
            ) : null}
          </div>
        ),
      };
    }

    // invoices
    if (step === 0) return {
      instruction: "This job is already done — the change is already on it.",
      body: (
        <div className="demo-guided-row">
          <span className="demo-chip is-inert">+ $45 · approved during the visit</span>
          <button type="button" className="btn" onClick={advance}>Got it →</button>
        </div>
      ),
    };
    if (step === 1) return {
      instruction: "Tap Generate Invoice.",
      body: <button type="button" className="btn btn-primary" onClick={advance}>Generate Invoice</button>,
    };
    return {
      instruction: "Invoice built from the job record — nothing retyped. This Job also keeps a VOW.",
      body: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div className="demo-invoice-mini">
            <div className="im-head"><span>VIZOW · INVOICE</span><span>#VZ-0826-041</span></div>
            <div className="im-body">
              <div className="im-line"><span>Labor · dimmer replacement</span><span>$420.00</span></div>
              <div className="im-line"><span>Materials</span><span>$86.40</span></div>
              <div className="im-line"><span>Approved change · box repair</span><span>$45.00</span></div>
            </div>
            <div className="im-total"><span>TOTAL DUE</span><span>$551.40</span></div>
            <div className="im-cta"><span>Download PDF</span><span>Send to client</span></div>
          </div>
          <div style={{ width: "100%", maxWidth: 380 }}>
            <p className="demo-vow-intro">The invoice is one output of this Job. The same Job also keeps a <strong>VOW</strong> — the complete visual record, start to finish, built the same way.</p>
            <VowFullCard title="Dining room dimmer replacement" cycle="Cycle 1 · Complete" client="Eli Collins" property="28 Ridgefield Ave, West Orange NJ" visits="1" notesCount="2" changeText="+$45 · approved" total="$551.40" />
          </div>
        </div>
      ),
    };
  }
}
