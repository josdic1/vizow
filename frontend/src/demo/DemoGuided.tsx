import { useEffect, useRef, useState, type ReactNode } from "react";
import { getDemoIssue } from "./demoReplacementIssues";
import { useDemo } from "./useDemo";

const TOTAL_STEPS = 3;

const PHOTO_A = "/media/door-alignment/A-1.png";
const PHOTO_B = "/media/door-alignment/B-1.png";
const PHOTO_D = "/media/door-alignment/D-1.png";

async function downloadInvoicePdf() {
  const { downloadDemoInvoicePdf } = await import("../pdf/demo-invoice-pdf");
  await downloadDemoInvoicePdf({ labor: 420, materials: 86.4, adjustment: 45 });
}

const MARKETING_CAPTION = "Bedroom door alignment in West Orange, NJ. Adjusted the door and jamb, documented from before through completion. #DoorRepair #Carpentry #WestOrangeNJ #HomeRepair";

const PHOTO_LIBRARY_ITEMS = [
  { id: "door-before", job: "Bedroom door alignment", client: "Eli Collins", stage: "before", cycle: 1, date: "Aug 11", city: "West Orange, NJ", src: PHOTO_A, note: "Door rubbing at the latch side before adjustment." },
  { id: "door-during", job: "Bedroom door alignment", client: "Eli Collins", stage: "during", cycle: 1, date: "Aug 11", city: "West Orange, NJ", src: PHOTO_B, note: "Jamb shifted; hinge and reveal checked during repair." },
  { id: "door-after", job: "Bedroom door alignment", client: "Eli Collins", stage: "after", cycle: 1, date: "Aug 13", city: "West Orange, NJ", src: PHOTO_D, note: "Door aligned and closing cleanly after adjustment." },
  { id: "ceiling-before", job: "Ceiling water damage", client: "Mara Collins", stage: "before", cycle: 1, date: "Aug 6", city: "South Orange, NJ", src: "/media/ceiling-water-damage/B-1.png", note: "Water stain and damaged finish documented before opening the ceiling." },
  { id: "ceiling-during", job: "Ceiling water damage", client: "Mara Collins", stage: "during", cycle: 1, date: "Aug 7", city: "South Orange, NJ", src: "/media/ceiling-water-damage/D-1.png", note: "Damaged section opened and repair documented in progress." },
  { id: "deck-before", job: "Deck stair repair", client: "Nick R.", stage: "before", cycle: 1, date: "Aug 4", city: "Maplewood, NJ", src: "/media/deck-stair-repair/B-1.png", note: "Loose stair section documented before repair." },
  { id: "deck-during", job: "Deck stair repair", client: "Nick R.", stage: "during", cycle: 1, date: "Aug 5", city: "Maplewood, NJ", src: "/media/deck-stair-repair/D-1.png", note: "Stair repair documented while the damaged section was being rebuilt." },
  { id: "roof-during", job: "Roof leak investigation", client: "Devon R.", stage: "during", cycle: 1, date: "Aug 3", city: "South Orange, NJ", src: "/media/roof-leak-investigation/D-1.png", note: "Leak path documented during the roof investigation." },
] as const;

type PhotoLibraryStage = "all" | "before" | "during" | "after";

async function downloadDemoMarketingPhoto(src: string) {
  const response = await fetch(src);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "vizow-bedroom-door-alignment.png";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

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
function JobIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
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
    <div className="demo-transit-map" style={locked ? { pointerEvents: "none" } : undefined}>
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
  {
    title: "Dining room dimmer buzzing",
    status: "Active",
    statusDetail: "Visit scheduled · Aug 18",
    date: "Aug 14",
    cycle: "Cycle 1",
    visits: "1 scheduled",
    photos: 1,
    invoice: "Not invoiced",
    amount: "$0",
    scope: "Diagnose the buzzing dimmer and replace the device if needed.",
    media: ["/media/dead-kitchen-outlet/B-1.png"],
  },
  {
    title: "Loose stair handrail",
    status: "Complete",
    statusDetail: "Closed · Jul 28",
    date: "Jul 26–28",
    cycle: "Cycle 1",
    visits: "2 visits",
    photos: 5,
    invoice: "Paid",
    amount: "$210",
    scope: "Secure loose exterior handrail and reinforce the stair connection.",
    media: [
      "/media/deck-stair-repair/B-1.png",
      "/media/deck-stair-repair/D-1.png",
      "/media/deck-stair-repair/A-1.png",
    ],
  },
  {
    title: "Bedroom door alignment",
    status: "Complete",
    statusDetail: "Closed · Aug 13",
    date: "Aug 10–13",
    cycle: "Cycle 1",
    visits: "2 visits",
    photos: 6,
    invoice: "Paid",
    amount: "$365",
    scope: "Align the bedroom door and jamb; approved hinge-side repair added during the Job.",
    media: [PHOTO_A, PHOTO_B, PHOTO_D],
  },
] as const;

const STOP_DOCS = [
  {
    eyebrow: "Request",
    date: "Aug 10",
    title: "Bedroom door rubbing at the top hinge",
    copy: "Eli sent the request with the address and the problem. Nothing had to be re-entered when the Job was created.",
    meta: "Client intake · 28 Ridgefield Ave",
  },
  {
    eyebrow: "Job created",
    date: "Aug 10",
    title: "Bedroom door alignment",
    copy: "Scope started as align door and inspect the jamb. The Job now owns every visit, note, photo, and change that follows.",
    meta: "Cycle 1 · Active",
  },
  {
    eyebrow: "Visit 1",
    date: "Aug 11",
    title: "Jamb movement discovered on site",
    copy: "The first visit exposed a shifted jamb. The photo and note stayed attached to this point in the Job Journey.",
    meta: "Scope change · +$45 approved",
    photo: PHOTO_B,
  },
  {
    eyebrow: "Visit 2",
    date: "Aug 13",
    title: "Door and jamb repaired",
    copy: "The return visit completed the added work. The approved change and both visits remain visible in order.",
    meta: "2 visits · work complete",
    photo: PHOTO_D,
  },
  {
    eyebrow: "Closed",
    date: "Aug 13",
    title: "Job closed with the full record intact",
    copy: "The final position is obvious: completed, one approved change, two visits, and $365 total. Nothing has to be reconstructed later.",
    meta: "Complete · $365.00",
    photo: PHOTO_A,
  },
] as const;

function RecordJourneyFrame({
  activeIndex,
  locked = false,
  onPick,
  onContinue,
  showDetail = false,
}: {
  activeIndex: number | null;
  locked?: boolean;
  onPick: (i: number) => void;
  onContinue?: () => void;
  showDetail?: boolean;
}) {
  const selectedIndex = activeIndex ?? TRANSIT_STOPS.length - 1;
  const selected = STOP_DOCS[selectedIndex];

  return (
    <div className="demo-record-app">
      <div className="demo-record-head">
        <div>
          <span className="demo-record-kicker">Job Journey</span>
          <strong>Bedroom door alignment</strong>
          <p>Eli Collins · 28 Ridgefield Ave, West Orange</p>
        </div>
        <div className="demo-record-position">
          <span>Current position</span>
          <strong>Closed</strong>
          <small>Cycle 1 · $365.00</small>
        </div>
      </div>

      <div className="demo-record-transit">
        <TransitMap activeIndex={activeIndex} locked={locked} onPick={onPick} />
      </div>

      {showDetail ? (
        <div className="demo-record-detail">
          <div className="demo-record-detail-copy">
            <div className="demo-record-detail-meta">
              <span>{selected.eyebrow}</span>
              <b>{selected.date}</b>
            </div>
            <strong>{selected.title}</strong>
            <p>{selected.copy}</p>
            <small>{selected.meta}</small>
          </div>
          {'photo' in selected ? (
            <img src={selected.photo} alt={`${selected.eyebrow} evidence`} />
          ) : (
            <div className="demo-record-no-photo">
              <JobIcon />
              <span>Record event</span>
              <small>No separate file to hunt down</small>
            </div>
          )}
        </div>
      ) : (
        <div className="demo-record-now">
          <div><span>Status</span><strong>Complete</strong></div>
          <div><span>Visits</span><strong>2</strong></div>
          <div><span>Scope change</span><strong>+$45 · approved</strong></div>
          <div><span>Total</span><strong>$365</strong></div>
        </div>
      )}

      <div className="demo-record-foot">
        <span>{showDetail ? "The rail stays fixed. Tap any stop and the evidence at that moment changes here." : "One line shows where the Job went, what changed, and where it ended."}</span>
        {onContinue ? <button type="button" className="btn" onClick={onContinue}>Got it →</button> : null}
      </div>
    </div>
  );
}

const CALCULATORS = ["Board feet", "Concrete", "Stud count", "Roofing sq", "Paint cvg", "Drywall", "Stair riser", "Markup"];

export function DemoGuided() {
  const { activeIssueId, backToList, completeActiveIssue } = useDemo();
  const issue = getDemoIssue(activeIssueId);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [toggleOn, setToggleOn] = useState(false);
  const [pickedPhoto, setPickedPhoto] = useState<number | null>(null);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [openStop, setOpenStop] = useState<number | null>(null);
  const historyDetailRef = useRef<HTMLElement | null>(null);
  const [fieldPanel, setFieldPanel] = useState<"photo" | "note" | "job" | "calc">("photo");
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [marketingCopied, setMarketingCopied] = useState(false);
  const [marketingSaved, setMarketingSaved] = useState(false);
  const [photoLibraryQuery, setPhotoLibraryQuery] = useState("");
  const [photoLibraryStage, setPhotoLibraryStage] = useState<PhotoLibraryStage>("all");
  const [photoLibraryPicked, setPhotoLibraryPicked] = useState("door-during");
  const [photoLibraryTourReady, setPhotoLibraryTourReady] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeIssueId !== "photos" || step !== 1) return;

    setPhotoLibraryQuery("");
    setPhotoLibraryStage("all");
    setPhotoLibraryPicked("door-after");
    setPhotoLibraryTourReady(false);

    const timers = [
      window.setTimeout(() => setPhotoLibraryStage("before"), 1200),
      window.setTimeout(() => setPhotoLibraryStage("during"), 2400),
      window.setTimeout(() => {
        setPhotoLibraryStage("after");
        setPhotoLibraryTourReady(true);
      }, 3600),
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeIssueId, step]);

  useEffect(() => {
    if (activeIssueId !== "history" || step !== 2 || openRow === null) return;

    const frame = window.requestAnimationFrame(() => {
      historyDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      historyDetailRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIssueId, openRow, step]);

  function advance() {
    if (step === TOTAL_STEPS - 2) {
      completeActiveIssue();
    }
    setStep((v) => Math.min(TOTAL_STEPS - 1, v + 1));
  }
  function finish() {
    backToList();
  }
  function pickStop(i: number) {
    setOpenStop(i);
    if (step < TOTAL_STEPS - 1) advance();
  }

  const { instruction, body } = renderStep();

  return (
    <div className="demo-guided">
      <button type="button" className="demo-back-link" onClick={backToList}>← Back to outcomes</button>

      <div className="demo-guided-top">
        <span>{issue.short}</span>
        <b>Step {step + 1} / {TOTAL_STEPS}</b>
        <em>{elapsed}s elapsed</em>
      </div>
      <div className="demo-guided-progress"><span style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} /></div>

      <div className="demo-guided-stage">
        <p className="demo-guided-instruction">{instruction}</p>
        <div className={`demo-guided-body${activeIssueId === "field" ? " demo-guided-body-field" : activeIssueId === "record" ? " demo-guided-body-record" : activeIssueId === "invoices" ? " demo-guided-body-invoices" : activeIssueId === "marketing" ? " demo-guided-body-marketing" : activeIssueId === "photos" ? " demo-guided-body-photos" : activeIssueId === "notes" ? " demo-guided-body-notes" : ""}`}>{body}</div>
      </div>

      {step === TOTAL_STEPS - 1 ? (
        <div className="demo-guided-finish">
          <button type="button" className="btn btn-primary" onClick={finish}>Back to outcomes →</button>
        </div>
      ) : null}
    </div>
  );

  function renderStep(): { instruction: string; body: ReactNode } {
    if (activeIssueId === "correspondence") {
      if (step === 0) return {
        instruction: "This is your calendar. Right now, nobody outside your business can see it.",
        body: (
          <div className="demo-calendar-intro">
            <div className="demo-calendar-intro-head">
              <div>
                <span className="sc-label">Your calendar</span>
                <strong>Tuesday · Aug 18</strong>
              </div>
              <span className="demo-private-state">Private</span>
            </div>
            <div className="demo-calendar-intro-events">
              <div className="demo-calendar-intro-time">9:00</div>
              <div className="demo-calendar-intro-event"><strong>Dimmer replace</strong><span>Eli Collins · Booked</span></div>
              <div className="demo-calendar-intro-time">1:00</div>
              <div className="demo-calendar-intro-event"><strong>Deck estimate</strong><span>Nick R. · Booked</span></div>
              <div className="demo-calendar-intro-time is-open">3:30</div>
              <div className="demo-calendar-intro-event is-open"><strong>Open</strong><span>No job scheduled</span></div>
            </div>
            <div className="demo-calendar-intro-foot">
              <p>Your real schedule stays accurate here. Public availability is a separate view.</p>
              <button type="button" className="btn" onClick={advance}>Got it →</button>
            </div>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Turn public availability ON.",
        body: (
          <div className="demo-public-control">
            <div className="demo-public-control-head">
              <div>
                <span className="sc-label">Public calendar</span>
                <strong>Off</strong>
                <p>Your schedule is still private. Clients cannot see availability yet.</p>
              </div>
              <span className="demo-private-state">Clients see nothing</span>
            </div>
            <div className="demo-public-control-body">
              <div className="demo-public-control-preview">
                <span className="sc-label">Client view</span>
                <strong>Availability hidden</strong>
                <p>When enabled, Vizow shows only Available, Limited, or Unavailable — never your job details.</p>
              </div>
              <button type="button" className={`demo-switch${toggleOn ? " is-on" : ""}`} onClick={() => { setToggleOn(true); advance(); }}>
                Turn public availability ON →
              </button>
            </div>
          </div>
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
      const photos = [
        { src: PHOTO_A, stage: "Before", note: "Door rubbing at the top hinge" },
        { src: PHOTO_B, stage: "During", note: "Jamb adjustment in progress" },
        { src: PHOTO_D, stage: "After", note: "Aligned, closing cleanly" },
      ];
      const selected = photos[pickedPhoto ?? 2];

      if (step === 0) return {
        instruction: "The work is already documented. These photos already belong to this Job.",
        body: (
          <div className="demo-marketing-app">
            <header className="demo-marketing-head">
              <div>
                <span className="demo-marketing-kicker">Job media</span>
                <strong>Bedroom door alignment</strong>
                <p>West Orange, NJ · Cycle 1 · Complete</p>
              </div>
              <div className="demo-marketing-head-meta">
                <span>3 photos</span>
                <strong>Before · During · After</strong>
              </div>
            </header>
            <div className="demo-marketing-gallery is-static">
              {photos.map((photo) => (
                <article key={photo.stage} className="demo-marketing-photo-card">
                  <img src={photo.src} alt={`${photo.stage} bedroom door alignment`} />
                  <div><span>{photo.stage}</span><strong>{photo.note}</strong></div>
                </article>
              ))}
            </div>
            <footer className="demo-marketing-foot">
              <p>No camera-roll hunt. No folders to reconstruct. The evidence is already organized by Job.</p>
              <button type="button" className="btn" onClick={advance}>Got it →</button>
            </footer>
          </div>
        ),
      };

      if (step === 1) return {
        instruction: "Choose the evidence you want to turn into a public work post.",
        body: (
          <div className="demo-marketing-app">
            <header className="demo-marketing-head">
              <div>
                <span className="demo-marketing-kicker">Create from Job</span>
                <strong>Bedroom door alignment</strong>
                <p>Select one photo. Vizow keeps the Job context with it.</p>
              </div>
              <span className="demo-marketing-public-badge">Client + exact address hidden</span>
            </header>
            <div className="demo-marketing-gallery">
              {photos.map((photo, i) => (
                <button
                  key={photo.stage}
                  type="button"
                  className="demo-marketing-photo-card demo-marketing-photo-button"
                  onClick={() => { setPickedPhoto(i); advance(); }}
                >
                  <img src={photo.src} alt={`${photo.stage} bedroom door alignment`} />
                  <div><span>{photo.stage}</span><strong>{photo.note}</strong><small>Use this photo →</small></div>
                </button>
              ))}
            </div>
            <footer className="demo-marketing-foot is-info">
              <p>Public output keeps the useful proof: work type, stage, town, and Job history — without client identity or exact location.</p>
            </footer>
          </div>
        ),
      };

      return {
        instruction: "Ready to publish. The photo, useful context, caption, and privacy cleanup came from the Job.",
        body: (
          <div className="demo-marketing-output">
            <div className="demo-social-preview">
              <div className="demo-social-head"><div className="demo-social-avatar" /><div><strong>rugged_built_llc</strong><span>West Orange, NJ</span></div></div>
              <img src={selected.src} alt="Selected bedroom door alignment work" />
              <div className="demo-social-actions">♡ <span>Comment</span><span>Share</span></div>
              <p><strong>rugged_built_llc</strong> {MARKETING_CAPTION}</p>
            </div>
            <aside className="demo-social-controls">
              <div>
                <span className="demo-marketing-kicker">Generated from Job</span>
                <h3>Post package ready</h3>
                <p>Use it as-is or edit it before posting. Vizow does not publish anything for you.</p>
              </div>
              <div className="demo-social-caption-box">
                <span>Caption</span>
                <p>{MARKETING_CAPTION}</p>
              </div>
              <div className="demo-social-privacy">
                <span>Public-safe</span>
                <strong>Client hidden · exact address hidden</strong>
              </div>
              <div className="demo-social-control-actions">
                <button
                  type="button"
                  className={`btn${marketingCopied ? " is-done" : ""}`}
                  onClick={() => {
                    void navigator.clipboard?.writeText(MARKETING_CAPTION);
                    setMarketingCopied(true);
                  }}
                >
                  {marketingCopied ? "Copied ✓" : "Copy caption"}
                </button>
                <button
                  type="button"
                  className={`btn btn-primary${marketingSaved ? " is-done" : ""}`}
                  onClick={() => {
                    void downloadDemoMarketingPhoto(selected.src);
                    setMarketingSaved(true);
                  }}
                >
                  {marketingSaved ? "Saved ✓" : "Save photo"}
                </button>
              </div>
              <small>Nothing was re-uploaded or retyped to create this output.</small>
            </aside>
          </div>
        ),
      };
    }

    if (activeIssueId === "photos") {
      const query = photoLibraryQuery.trim().toLowerCase();
      const visiblePhotos = PHOTO_LIBRARY_ITEMS.filter((photo) => {
        if (photoLibraryStage !== "all" && photo.stage !== photoLibraryStage) return false;
        if (!query) return true;
        return [photo.job, photo.client, photo.stage, photo.city, photo.note, `cycle ${photo.cycle}`]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
      const picked = PHOTO_LIBRARY_ITEMS.find((photo) => photo.id === photoLibraryPicked) ?? PHOTO_LIBRARY_ITEMS[1];
      const stageCounts = {
        all: PHOTO_LIBRARY_ITEMS.length,
        before: PHOTO_LIBRARY_ITEMS.filter((photo) => photo.stage === "before").length,
        during: PHOTO_LIBRARY_ITEMS.filter((photo) => photo.stage === "during").length,
        after: PHOTO_LIBRARY_ITEMS.filter((photo) => photo.stage === "after").length,
      };
      const stageLabel = (value: PhotoLibraryStage) => value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1);

      if (step === 0) return {
        instruction: "The camera roll is no longer the filing system. Every photo already belongs to a Job.",
        body: (
          <div className="demo-media-app">
            <div className="demo-media-head">
              <div>
                <span className="demo-media-kicker">Media</span>
                <strong>Contractor Media Library</strong>
                <p>Job photos, with the work context still attached.</p>
              </div>
              <div className="demo-media-head-meta"><strong>{PHOTO_LIBRARY_ITEMS.length}</strong><span>demo photos</span></div>
            </div>
            <div className="demo-media-toolbar is-preview">
              <div className="demo-media-search is-inert">Search photos…</div>
              <div className="demo-media-selects"><span>All clients</span><span>All Jobs</span><span>Newest</span></div>
              <div className="demo-media-stage-tabs" aria-label="Photo stages">
                {(Object.keys(stageCounts) as PhotoLibraryStage[]).map((value) => (
                  <span className={value === "all" ? "is-active" : ""} key={value}>{stageLabel(value)} <b>{stageCounts[value]}</b></span>
                ))}
              </div>
            </div>
            <div className="demo-media-grid">
              {PHOTO_LIBRARY_ITEMS.map((photo) => (
                <article className="demo-media-card" key={photo.id}>
                  <div className="demo-media-card-photo"><img src={photo.src} alt={`${photo.stage} ${photo.job}`} /><span>{photo.stage}</span></div>
                  <div className="demo-media-card-copy"><strong>{photo.job}</strong><small>{photo.client} · Cycle {photo.cycle}</small></div>
                </article>
              ))}
            </div>
            <div className="demo-media-foot">
              <span>Job · client · cycle · stage · date stay with the photo.</span>
              <button type="button" className="btn" onClick={advance}>Got it →</button>
            </div>
          </div>
        ),
      };

      if (step === 1) return {
        instruction: "Watch the stage filters narrow the library. When one photo remains, open it.",
        body: (
          <div className={`demo-media-app demo-media-guided-filter${photoLibraryTourReady ? " is-ready" : " is-touring"}`}>
            <div className="demo-media-head">
              <div>
                <span className="demo-media-kicker">Media</span>
                <strong>Contractor Media Library</strong>
                <p>{photoLibraryTourReady ? "One After photo remains. Open it to inspect the Job context." : "Watch the stage filter move from All → Before → During → After."}</p>
              </div>
              <div className="demo-media-head-meta"><strong>{visiblePhotos.length}</strong><span>showing</span></div>
            </div>
            <div className="demo-media-toolbar">
              <label className="demo-media-search">
                <span className="sr-only">Search demo Media Library</span>
                <input
                  value={photoLibraryQuery}
                  readOnly={!photoLibraryTourReady}
                  onChange={(event) => setPhotoLibraryQuery(event.currentTarget.value)}
                  placeholder="Try: door alignment"
                />
              </label>
              <div className="demo-media-selects"><span>All clients</span><span>All Jobs</span><span>Newest</span></div>
              <div className="demo-media-stage-tabs" role="group" aria-label="Filter photo stage">
                {(Object.keys(stageCounts) as PhotoLibraryStage[]).map((value) => (
                  <button
                    className={photoLibraryStage === value ? "is-active" : ""}
                    disabled={!photoLibraryTourReady}
                    key={value}
                    type="button"
                    onClick={() => setPhotoLibraryStage(value)}
                  >
                    {stageLabel(value)} <b>{stageCounts[value]}</b>
                  </button>
                ))}
              </div>
            </div>
            <div className={`demo-media-grid${visiblePhotos.length <= 3 ? " is-focused" : ""}`}>
              {visiblePhotos.length ? visiblePhotos.map((photo) => (
                <button
                  type="button"
                  className={`demo-media-card demo-media-card-button${photoLibraryTourReady && photo.id === "door-after" ? " is-guided-target" : ""}`}
                  disabled={!photoLibraryTourReady}
                  key={photo.id}
                  onClick={() => { setPhotoLibraryPicked(photo.id); advance(); }}
                >
                  <div className="demo-media-card-photo"><img src={photo.src} alt={`${photo.stage} ${photo.job}`} /><span>{photo.stage}</span></div>
                  <div className="demo-media-card-copy"><strong>{photo.job}</strong><small>{photo.client} · {photo.city}</small><em>Open photo →</em></div>
                </button>
              )) : <div className="demo-media-empty"><strong>No matches.</strong><span>Try Job, client, stage, or town.</span></div>}
            </div>
            <div className="demo-media-foot demo-media-foot-action demo-media-guided-foot">
              <span>{photoLibraryTourReady ? "After → one result. That photo is the next move." : "Filtering automatically…"}</span>
              <button
                type="button"
                className={`btn demo-media-got-it${photoLibraryTourReady ? " is-ready" : ""}`}
                disabled={!photoLibraryTourReady}
                onClick={() => { setPhotoLibraryPicked("door-after"); advance(); }}
              >
                Got it →
              </button>
            </div>
          </div>
        ),
      };

      return {
        instruction: "Found. The photo still knows exactly where it came from.",
        body: (
          <div className="demo-media-app demo-media-app-detail">
            <div className="demo-media-head">
              <div>
                <span className="demo-media-kicker">Media detail</span>
                <strong>{picked.job}</strong>
                <p>{picked.client} · {picked.city}</p>
              </div>
              <span className={`demo-media-stage-chip is-${picked.stage}`}>{picked.stage}</span>
            </div>
            <div className="demo-media-detail-grid">
              <div className="demo-media-detail-image"><img src={picked.src} alt={`${picked.stage} evidence for ${picked.job}`} /></div>
              <div className="demo-media-detail-copy">
                <div className="demo-media-detail-facts">
                  <div><span>Job</span><strong>{picked.job}</strong></div>
                  <div><span>Client</span><strong>{picked.client}</strong></div>
                  <div><span>Stage</span><strong>{stageLabel(picked.stage)}</strong></div>
                  <div><span>Cycle</span><strong>{picked.cycle}</strong></div>
                  <div><span>Captured</span><strong>{picked.date}</strong></div>
                  <div><span>Location</span><strong>{picked.city}</strong></div>
                </div>
                <div className="demo-media-detail-note"><span>Attached note</span><p>{picked.note}</p></div>
              </div>
            </div>
            <div className="demo-media-foot">
              <span>The same Job media can now be selected for a social post, customer update, work sample, or PDF.</span>
              <strong>One record. Reused.</strong>
            </div>
          </div>
        ),
      };
    }

    if (activeIssueId === "notes") {
      const jobNotes = [
        { id: "intake", when: "Aug 10", context: "Request", title: "Client intake", text: "Door rubbing at the top hinge. Harder to close when the weather is humid." },
        { id: "visit", when: "Aug 11", context: "Visit 1", title: "Field note", text: "Jamb also shifted. Client approved the extra hinge-side repair for the return visit." },
        { id: "close", when: "Aug 13", context: "Visit 2", title: "Completion note", text: "Door aligned, reveal corrected, and closing cleanly after adjustment." },
      ] as const;

      if (step === 0) return {
        instruction: "Open the Job. Its notes are already separated from every other note you've ever taken.",
        body: (
          <div className="demo-notes-app">
            <header className="demo-notes-head">
              <div>
                <span className="demo-notes-kicker">Job notes</span>
                <strong>Bedroom door alignment</strong>
                <p>Eli Collins · 28 Ridgefield Ave, West Orange</p>
              </div>
              <div className="demo-notes-position"><span>Current Job</span><strong>Cycle 1 · Active</strong></div>
            </header>

            <div className="demo-notes-summary">
              <div><strong>3</strong><span>Notes</span></div>
              <div><strong>2</strong><span>Visits</span></div>
              <div><strong>6</strong><span>Photos</span></div>
              <div><strong>1</strong><span>Cycle</span></div>
            </div>

            <div className="demo-notes-list">
              {jobNotes.map((note) => (
                <article key={note.id}>
                  <div className="demo-notes-list-meta"><span>{note.context}</span><time>{note.when}</time></div>
                  <strong>{note.title}</strong>
                  <p>{note.text}</p>
                </article>
              ))}
            </div>

            <footer className="demo-notes-foot">
              <span>Only notes attached to this Job are here. No global phone-note hunt.</span>
              <button type="button" className="btn" onClick={advance}>Got it →</button>
            </footer>
          </div>
        ),
      };

      if (step === 1) return {
        instruction: "Write it here. The Job, cycle, and visit are already known.",
        body: (
          <div className="demo-notes-app demo-notes-compose">
            <header className="demo-notes-head">
              <div>
                <span className="demo-notes-kicker">Quick note</span>
                <strong>Bedroom door alignment</strong>
                <p>Eli Collins · Cycle 1 · Visit 1 · Aug 11</p>
              </div>
              <span className="demo-notes-context-chip">Job context locked</span>
            </header>

            <div className="demo-notes-compose-grid">
              <section className="demo-notes-context">
                <span className="demo-notes-kicker">Already attached to</span>
                <dl>
                  <div><dt>Job</dt><dd>Bedroom door alignment</dd></div>
                  <div><dt>Client</dt><dd>Eli Collins</dd></div>
                  <div><dt>Cycle</dt><dd>1 · Active</dd></div>
                  <div><dt>Visit</dt><dd>Visit 1 · Aug 11</dd></div>
                </dl>
              </section>

              <section className="demo-notes-editor">
                <label htmlFor="demo-note-draft">Field note</label>
                <textarea id="demo-note-draft" defaultValue="Jamb also shifted. Client approved the extra hinge-side repair for the return visit." />
                <div className="demo-notes-editor-foot">
                  <span>No filename. No folder. No client picker.</span>
                  <button type="button" className="btn btn-primary" onClick={advance}>Save to Job →</button>
                </div>
              </section>
            </div>
          </div>
        ),
      };

      return {
        instruction: "Saved once. The note stays with the exact Job moment it belongs to.",
        body: (
          <div className="demo-notes-app demo-notes-result">
            <header className="demo-notes-head">
              <div>
                <span className="demo-notes-kicker">Job notes</span>
                <strong>Bedroom door alignment</strong>
                <p>Eli Collins · 28 Ridgefield Ave, West Orange</p>
              </div>
              <span className="demo-notes-saved-chip">Saved ✓</span>
            </header>

            <div className="demo-notes-result-grid">
              <div className="demo-notes-result-list">
                {jobNotes.map((note) => (
                  <article className={note.id === "visit" ? "is-saved" : ""} key={note.id}>
                    <div className="demo-notes-list-meta"><span>{note.context}</span><time>{note.when}</time></div>
                    <strong>{note.title}</strong>
                    <p>{note.text}</p>
                  </article>
                ))}
              </div>

              <section className="demo-notes-detail">
                <span className="demo-notes-kicker">Saved to the record</span>
                <h3>Jamb also shifted.</h3>
                <p>Client approved the extra hinge-side repair for the return visit.</p>
                <div className="demo-notes-detail-facts">
                  <div><span>Job</span><strong>Bedroom door alignment</strong></div>
                  <div><span>Moment</span><strong>Visit 1 · Aug 11</strong></div>
                  <div><span>Cycle</span><strong>1 · Active</strong></div>
                  <div><span>Available with</span><strong>Journey · Job record</strong></div>
                </div>
              </section>
            </div>

            <footer className="demo-notes-foot demo-notes-foot-final">
              <span>Write it where the work happens. Find it where the work lives.</span>
              <strong>One Job. One record.</strong>
            </footer>
          </div>
        ),
      };
    }

    if (activeIssueId === "history") {
      const selectedHistoryJob = HISTORY_JOBS[openRow ?? 2];

      if (step === 0) return {
        instruction: "One client record. The relationship is already assembled.",
        body: (
          <div className="demo-client-history">
            <header className="demo-client-history-head">
              <div>
                <p className="eyebrow">Client record</p>
                <h3>Eli Collins</h3>
                <p>eli.collins@example.test · 973-555-0148</p>
              </div>
              <span className="demo-client-repeat">Repeat client</span>
            </header>

            <div className="demo-client-history-metrics">
              <div><strong>3</strong><span>Jobs</span></div>
              <div><strong>18</strong><span>Photos</span></div>
              <div><strong>$1,240</strong><span>Invoiced</span></div>
              <div><strong>1</strong><span>Property</span></div>
            </div>

            <div className="demo-client-history-body">
              <section className="demo-client-property">
                <p className="eyebrow">Property</p>
                <strong>28 Ridgefield Ave</strong>
                <span>West Orange, NJ</span>
                <small>Every Job below stays tied to this client and property.</small>
              </section>
              <section className="demo-client-history-summary">
                <p className="eyebrow">Relationship</p>
                <strong>3 Jobs across the same client record</strong>
                <p>No contact search, notebook reconstruction, or separate photo hunt.</p>
              </section>
            </div>

            <footer className="demo-client-history-footer">
              <span>Client → property → Jobs → visits → media → invoices</span>
              <button type="button" className="btn" onClick={advance}>Got it →</button>
            </footer>
          </div>
        ),
      };

      if (step === 1) return {
        instruction: "Open any past Job. The client record does not move; the work opens inside it.",
        body: (
          <div className="demo-client-history">
            <header className="demo-client-history-head">
              <div>
                <p className="eyebrow">Client record</p>
                <h3>Eli Collins</h3>
                <p>28 Ridgefield Ave · West Orange, NJ</p>
              </div>
              <span className="demo-client-repeat">3 Jobs</span>
            </header>
            <div className="demo-client-history-metrics">
              <div><strong>3</strong><span>Jobs</span></div>
              <div><strong>18</strong><span>Photos</span></div>
              <div><strong>$1,240</strong><span>Invoiced</span></div>
              <div><strong>1</strong><span>Property</span></div>
            </div>
            <div className="demo-client-job-list">
              {HISTORY_JOBS.map((job, i) => (
                <button key={job.title} type="button" onClick={() => { setOpenRow(i); advance(); }}>
                  <span className="demo-client-job-main">
                    <strong>{job.title}</strong>
                    <small>{job.date} · {job.cycle} · {job.photos} photos</small>
                  </span>
                  <span className="demo-client-job-status">
                    <strong>{job.status}</strong>
                    <small>{job.statusDetail}</small>
                  </span>
                  <span className="demo-client-job-amount">{job.amount}</span>
                  <span className="demo-client-job-open">Open →</span>
                </button>
              ))}
            </div>
            <footer className="demo-client-history-footer">
              <span>Choose a Job to inspect its record.</span>
              <strong>Next → open any Job</strong>
            </footer>
          </div>
        ),
      };

      return {
        instruction: "The client history stays fixed. Pick another Job and only the detail changes.",
        body: (
          <div className="demo-client-history demo-client-history-detail-mode">
            <header className="demo-client-history-head">
              <div>
                <p className="eyebrow">Client record</p>
                <h3>Eli Collins</h3>
                <p>28 Ridgefield Ave · West Orange, NJ</p>
              </div>
              <div className="demo-client-history-head-total"><span>Relationship total</span><strong>$1,240</strong></div>
            </header>

            <div className="demo-client-history-detail-grid">
              <nav className="demo-client-history-nav" aria-label="Client Jobs">
                {HISTORY_JOBS.map((job, i) => (
                  <button key={job.title} type="button" className={(openRow ?? 2) === i ? "is-active" : ""} onClick={() => setOpenRow(i)}>
                    <span><strong>{job.title}</strong><small>{job.statusDetail}</small></span>
                    <b>{job.amount}</b>
                  </button>
                ))}
              </nav>

              <section className="demo-client-job-detail" ref={historyDetailRef} tabIndex={-1}>
                <header>
                  <div>
                    <p className="eyebrow">Selected Job</p>
                    <h4>{selectedHistoryJob.title}</h4>
                    <p>{selectedHistoryJob.scope}</p>
                  </div>
                  <span className={selectedHistoryJob.status === "Complete" ? "is-complete" : "is-active"}>{selectedHistoryJob.status}</span>
                </header>

                <div className="demo-client-job-facts">
                  <div><span>Cycle</span><strong>{selectedHistoryJob.cycle.replace("Cycle ", "")}</strong></div>
                  <div><span>Visits</span><strong>{selectedHistoryJob.visits}</strong></div>
                  <div><span>Photos</span><strong>{selectedHistoryJob.photos}</strong></div>
                  <div><span>Invoice</span><strong>{selectedHistoryJob.invoice}</strong></div>
                </div>

                <div className="demo-client-job-media">
                  {selectedHistoryJob.media.map((src, i) => (
                    <img key={`${selectedHistoryJob.title}-${i}`} src={src} alt="" />
                  ))}
                </div>

                <footer>
                  <div><span>Job amount</span><strong>{selectedHistoryJob.amount}</strong></div>
                  <div className="demo-client-job-links"><span>Journey</span><span>Media</span><span>Invoice</span><span>VOW</span></div>
                </footer>
              </section>
            </div>

            <footer className="demo-client-history-footer">
              <span>One client record. Every Job remains separately inspectable.</span>
              <strong>Client history stays put.</strong>
            </footer>
          </div>
        ),
      };
    }

    if (activeIssueId === "record") {
      if (step === 0) return {
        instruction: "One Job. One clear position. You can see the whole path without remembering it.",
        body: (
          <RecordJourneyFrame
            activeIndex={null}
            locked
            onPick={() => {}}
            onContinue={advance}
          />
        ),
      };
      if (step === 1) return {
        instruction: "Tap any stop on the Journey to see what actually happened there.",
        body: (
          <RecordJourneyFrame
            activeIndex={null}
            onPick={pickStop}
          />
        ),
      };
      return {
        instruction: "The Job stays in one shape. Only the moment you are inspecting changes.",
        body: (
          <RecordJourneyFrame
            activeIndex={openStop}
            onPick={pickStop}
            showDetail
          />
        ),
      };
    }

    if (activeIssueId === "field") {
      if (step === 0) return {
        instruction: "This is Field Mode — one job, four big tools, nothing else to hunt for.",
        body: (
          <div className="demo-field-app">
            <div className="demo-field-app-head">
              <span className="demo-field-mode-badge"><i />Field Mode</span>
              <div className="demo-field-current-job">
                <small>Current Job</small>
                <strong>Bedroom door alignment</strong>
                <span>Eli Collins · 28 Ridgefield Ave, West Orange</span>
              </div>
            </div>
            <div className="demo-field-ticks" />
            <div className="demo-field-tool-grid">
              <div className="demo-field-tool is-inert"><CameraIcon /><strong>Camera</strong><span>Capture Job evidence</span></div>
              <div className="demo-field-tool is-inert"><NoteIcon /><strong>Notes</strong><span>Save what happened</span></div>
              <div className="demo-field-tool is-inert"><JobIcon /><strong>Job</strong><span>Scope, visits, media</span></div>
              <div className="demo-field-tool is-inert"><CalcIcon /><strong>Nailed-It</strong><span>Jobsite calculators</span></div>
            </div>
            <div className="demo-field-app-foot">
              <span>No client picker. No folder picker. Field Mode already knows the Job.</span>
              <button type="button" className="demo-field-continue" onClick={advance}>Got it →</button>
            </div>
          </div>
        ),
      };
      if (step === 1) return {
        instruction: "Tap Camera. The photo will already belong to this Job.",
        body: (
          <div className="demo-field-app">
            <div className="demo-field-app-head">
              <span className="demo-field-mode-badge"><i />Field Mode</span>
              <div className="demo-field-current-job">
                <small>Current Job</small>
                <strong>Bedroom door alignment</strong>
                <span>Eli Collins · Cycle 1 · Active</span>
              </div>
            </div>
            <div className="demo-field-ticks" />
            <div className="demo-field-tool-grid">
              <button type="button" className="demo-field-tool is-primary" onClick={advance}><CameraIcon /><strong>Camera</strong><span>Tap to take photo</span></button>
              <div className="demo-field-tool is-muted"><NoteIcon /><strong>Notes</strong><span>Save what happened</span></div>
              <div className="demo-field-tool is-muted"><JobIcon /><strong>Job</strong><span>Scope, visits, media</span></div>
              <div className="demo-field-tool is-muted"><CalcIcon /><strong>Nailed-It</strong><span>Jobsite calculators</span></div>
            </div>
            <div className="demo-field-app-foot is-quiet">
              <span>Camera is the only active control for this step.</span>
            </div>
          </div>
        ),
      };
      return {
        instruction: "Captured once. Filed once. The rest of the Job is still one tap away.",
        body: (
          <div className="demo-field-app demo-field-app-result">
            <div className="demo-field-app-head">
              <span className="demo-field-mode-badge"><i />Field Mode</span>
              <div className="demo-field-current-job">
                <small>Current Job</small>
                <strong>Bedroom door alignment</strong>
                <span>Eli Collins · Cycle 1 · Active</span>
              </div>
            </div>
            <div className="demo-field-ticks" />
            <div className="demo-field-result-grid">
              <div className="demo-field-tool-grid demo-field-tool-grid-compact">
                <button type="button" className={`demo-field-tool${fieldPanel === "photo" ? " is-primary" : ""}`} onClick={() => setFieldPanel("photo")}><CameraIcon /><strong>Camera</strong></button>
                <button type="button" className={`demo-field-tool${fieldPanel === "note" ? " is-primary" : ""}`} onClick={() => setFieldPanel("note")}><NoteIcon /><strong>Notes</strong></button>
                <button type="button" className={`demo-field-tool${fieldPanel === "job" ? " is-primary" : ""}`} onClick={() => setFieldPanel("job")}><JobIcon /><strong>Job</strong></button>
                <button type="button" className={`demo-field-tool${fieldPanel === "calc" ? " is-primary" : ""}`} onClick={() => setFieldPanel("calc")}><CalcIcon /><strong>Nailed-It</strong></button>
              </div>

              <div className="demo-field-result-panel">
                {fieldPanel === "photo" ? (
                  <div className="demo-field-photo-result">
                    <img src={PHOTO_A} alt="Door alignment job photo" />
                    <div>
                      <span className="demo-field-saved">Saved</span>
                      <strong>During photo</strong>
                      <p>Attached automatically to Bedroom door alignment.</p>
                      <small>Job media · Cycle 1 · Aug 14</small>
                    </div>
                  </div>
                ) : null}
                {fieldPanel === "note" ? (
                  <div className="demo-field-detail-card">
                    <span>Quick note</span>
                    <strong>Jamb also shifted.</strong>
                    <p>Client approved the extra repair for Tuesday's visit. Saved directly to the Job Journey.</p>
                  </div>
                ) : null}
                {fieldPanel === "job" ? (
                  <div className="demo-field-job-card">
                    <div><span>Client</span><strong>Eli Collins</strong></div>
                    <div><span>Scope</span><strong>Align bedroom door + jamb</strong></div>
                    <div><span>Cycle</span><strong>1 · Active</strong></div>
                    <div><span>Next</span><strong>Tuesday · Finish repair</strong></div>
                  </div>
                ) : null}
                {fieldPanel === "calc" ? (
                  <div className="demo-field-calc-panel">
                    <div className="demo-field-calc-title"><span>Nailed-It</span><strong>Quick calculators</strong></div>
                    <div className="demo-calc-grid">{CALCULATORS.map((c) => <div key={c}><CalcIcon />{c}</div>)}</div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="demo-field-app-foot">
              <span>The photo is already on this Job. Nothing to rename, move, or remember later.</span>
              <span className="demo-field-job-tag">Auto-tagged · Bedroom door alignment</span>
            </div>
          </div>
        ),
      };
    }

    // invoices
    if (step === 0) return {
      instruction: "The Job is complete. The approved change is already part of the billing record.",
      body: (
        <div className="demo-invoice-app">
          <div className="demo-invoice-app-head">
            <div>
              <span className="demo-invoice-kicker">Job billing record</span>
              <strong>Dining room dimmer replacement</strong>
              <p>Eli Collins · 28 Ridgefield Ave, West Orange</p>
            </div>
            <div className="demo-invoice-position">
              <span>Job status</span>
              <strong>Complete</strong>
              <small>Cycle 1 · Aug 13</small>
            </div>
          </div>

          <div className="demo-invoice-record-grid">
            <div className="demo-invoice-record-main">
              <div className="demo-invoice-record-label">Captured as the work happened</div>
              <div className="demo-invoice-record-row">
                <div><strong>Original work</strong><span>Labor + materials</span></div>
                <b>$506.40</b>
              </div>
              <div className="demo-invoice-record-row is-change">
                <div><strong>Approved change</strong><span>Additional box repair · approved during Visit 1</span></div>
                <b>+$45.00</b>
              </div>
              <div className="demo-invoice-record-total"><span>Job total</span><strong>$551.40</strong></div>
            </div>

            <div className="demo-invoice-record-proof">
              <div><span>Visits</span><strong>2</strong></div>
              <div><span>Change status</span><strong>Approved</strong></div>
              <div><span>Amount due</span><strong>$551.40</strong></div>
            </div>
          </div>

          <div className="demo-invoice-app-foot">
            <span>No scraps to reconcile. The approved change is already attached to the Job.</span>
            <button type="button" className="btn" onClick={advance}>Got it →</button>
          </div>
        </div>
      ),
    };

    if (step === 1) return {
      instruction: "Generate the invoice from the Job record — no rebuilding the work by hand.",
      body: (
        <div className="demo-invoice-app">
          <div className="demo-invoice-app-head">
            <div>
              <span className="demo-invoice-kicker">Ready to bill</span>
              <strong>Dining room dimmer replacement</strong>
              <p>Completed Job · approved change included</p>
            </div>
            <div className="demo-invoice-position">
              <span>Total</span>
              <strong>$551.40</strong>
              <small>3 line items</small>
            </div>
          </div>

          <div className="demo-invoice-build-grid">
            <div className="demo-invoice-source">
              <span className="demo-invoice-kicker">Source: Job record</span>
              <div><span>Labor · dimmer replacement</span><strong>$420.00</strong></div>
              <div><span>Materials · switch, plate, connectors</span><strong>$86.40</strong></div>
              <div className="is-change"><span>Approved change · box repair</span><strong>$45.00</strong></div>
              <p>Scope, approval, and amount are already connected to this Job.</p>
            </div>

            <div className="demo-invoice-build-action">
              <span>Invoice preview</span>
              <strong>$551.40</strong>
              <small>Bill to Eli Collins</small>
              <button type="button" className="btn btn-primary" onClick={advance}>Generate invoice →</button>
            </div>
          </div>

          <div className="demo-invoice-app-foot is-quiet">
            <span>Nothing is retyped. Generating the invoice is an output of the existing Job.</span>
          </div>
        </div>
      ),
    };

    return {
      instruction: "Invoice ready. The approved change became a line item automatically.",
      body: (
        <div className="demo-invoice-app demo-invoice-app-final">
          <div className="demo-invoice-document">
            <div className="demo-invoice-document-head">
              <div><span className="demo-invoice-brand">VIZOW</span><small>Work invoice</small></div>
              <div><strong>INVOICE</strong><span>#VZ-0826-041 · Aug 13, 2026</span></div>
            </div>

            <div className="demo-invoice-parties">
              <div><span>Bill to</span><strong>Eli Collins</strong><p>28 Ridgefield Avenue<br />West Orange, NJ</p></div>
              <div><span>Job</span><strong>Dining room dimmer replacement</strong><p>Cycle 1 · Complete<br />Approved change included</p></div>
            </div>

            <div className="demo-invoice-lines">
              <div className="is-head"><span>Description</span><span>Amount</span></div>
              <div><span>Labor · dimmer replacement</span><span>$420.00</span></div>
              <div><span>Materials · switch, plate, connectors</span><span>$86.40</span></div>
              <div className="is-change"><span>Approved change · additional box repair</span><span>$45.00</span></div>
            </div>

            <div className="demo-invoice-total-row"><span>Total due</span><strong>$551.40</strong></div>
          </div>

          <div className="demo-invoice-final-actions">
            <div>
              <span className="demo-invoice-kicker">Built from the Job</span>
              <strong>Nothing reconstructed.</strong>
              <p>The approved change, visit history, and billing amount remain tied to the same Job record.</p>
            </div>
            <div className="demo-invoice-buttons">
              <button type="button" className="btn" onClick={() => void downloadInvoicePdf()}>Download PDF</button>
              <button type="button" className={`btn${invoiceSent ? " is-sent" : " btn-primary"}`} onClick={() => setInvoiceSent(true)}>{invoiceSent ? "Sent ✓" : "Send to client"}</button>
            </div>
          </div>
        </div>
      ),
    };
  }
}
