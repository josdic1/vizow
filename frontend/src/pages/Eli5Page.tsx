import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  fetchDemoSessionStatus,
  resetPrivateDemo,
  startPrivateDemo,
} from "../api/demoSession";
import { defaultAppEntryPath } from "../utils/appEntry";
import "../styles/eli5-workday.css";

type StageId = "calendar" | "today" | "vow" | "marketing" | "notes" | "media" | "data" | "done";

type PlaybackSpeed = "slow" | "medium" | "fast";

type Stage = {
  id: StageId;
  label: string;
  start: number;
  end: number;
  headline: string;
  copy: string;
};

const TOTAL_SECONDS = 60;

const STAGES: Stage[] = [
  {
    id: "marketing",
    label: "MARKETING",
    start: 0,
    end: 10,
    headline: "Turn finished work into ready-to-post marketing.",
    copy: "",
  },
  {
    id: "calendar",
    label: "CALENDAR",
    start: 10,
    end: 17,
    headline: "Book the work and control what customers see.",
    copy: "",
  },
  {
    id: "today",
    label: "TODAY",
    start: 17,
    end: 25,
    headline: "See today's route and know the next stop.",
    copy: "",
  },
  {
    id: "vow",
    label: "VOW",
    start: 25,
    end: 33,
    headline: "Keep the complete visual record of every Job.",
    copy: "",
  },
  {
    id: "notes",
    label: "NOTES",
    start: 33,
    end: 40,
    headline: "Find the note instead of remembering where you put it.",
    copy: "",
  },
  {
    id: "media",
    label: "MEDIA",
    start: 40,
    end: 47,
    headline: "Find any Job photo fast.",
    copy: "",
  },
  {
    id: "data",
    label: "DATA",
    start: 47,
    end: 57,
    headline: "See the business hiding inside the work.",
    copy: "",
  },
  {
    id: "done",
    label: "DONE",
    start: 57,
    end: 60,
    headline: "Vizow keeps the whole operation connected.",
    copy: "",
  },
];

function getStage(elapsed: number) {
  return STAGES.find((stage) => elapsed >= stage.start && elapsed < stage.end) ?? STAGES[STAGES.length - 1];
}

type Narration = { key: string; title: string };

function getNarration(stage: StageId, progress: number): Narration {
  if (stage === "calendar") {
    if (progress < 0.12) return { key: "calendar-1", title: "First: your booked Jobs land on the real calendar." };
    if (progress < 0.5) return { key: "calendar-2", title: "Watch the week fill with actual visits." };
    if (progress < 0.66) return { key: "calendar-3", title: "Now Vizow turns that schedule into public availability." };
    return { key: "calendar-4", title: "Customers see when you are free — not who you are visiting." };
  }
  if (stage === "today") {
    if (progress < 0.18) return { key: "today-1", title: "Today turns the calendar into a transit map." };
    if (progress < 0.42) return { key: "today-2", title: "The current stop is obvious. The rest of the route stays visible." };
    if (progress < 0.72) return { key: "today-3", title: "Finish a stop. The next one becomes current." };
    return { key: "today-4", title: "No rebuilding the day from texts, addresses, and memory." };
  }
  if (stage === "vow") {
    if (progress < 0.18) return { key: "vow-1", title: "These are finished Jobs." };
    if (progress < 0.42) return { key: "vow-2", title: "Open one. Its Visual of Work comes forward." };
    if (progress < 0.72) return { key: "vow-3", title: "Before and after stay attached to that Job." };
    return { key: "vow-4", title: "Drag the line. The finished work is the proof." };
  }
  if (stage === "marketing") {
    if (progress < 0.22) return { key: "marketing-1", title: "Start with a finished Visual of Work." };
    if (progress < 0.48) return { key: "marketing-2", title: "Turn it into an Instagram post." };
    if (progress < 0.74) return { key: "marketing-3", title: "Now make the Facebook post." };
    return { key: "marketing-4", title: "Now make the TikTok / Reel." };
  }
  if (stage === "notes") {
    if (progress < 0.2) return { key: "notes-1", title: "You remember one word from a note." };
    if (progress < 0.5) return { key: "notes-2", title: "Type it. Vizow finds the note, the client, and the Job." };
    return { key: "notes-3", title: "The note stays attached to the work instead of disappearing into your phone." };
  }
  if (stage === "media") {
    if (progress < 0.18) return { key: "media-1", title: "Need an old photo? Type what you remember." };
    if (progress < 0.46) return { key: "media-2", title: "Vizow narrows the library while you type." };
    return { key: "media-3", title: "The Job photos you wanted are already together." };
  }
  if (stage === "data") {
    if (progress < 0.2) return { key: "data-1", title: "Your Jobs already contain the business data." };
    if (progress < 0.58) return { key: "data-2", title: "See volume, status, geography, work mix, evidence, and repeat clients at once." };
    return { key: "data-3", title: "Then filter the same Jobs and export exactly what you need." };
  }
  if (progress < 0.48) return { key: "done-1", title: "That is Vizow in one minute." };
  return { key: "done-2", title: "Schedule it. Run it. Prove it. Market it. Report on it." };
}

function formatClock(remaining: number) {
  const whole = Math.max(0, Math.ceil(remaining));
  return `00:${String(whole).padStart(2, "0")}`;
}

const weekVisits = [
  { day: "MON", date: "17", visits: [] as string[] },
  { day: "TUE", date: "18", visits: ["Sump pump problem", "Drywall repair"] },
  { day: "WED", date: "19", visits: ["Ceiling water damage", "Exterior trim repair", "Roof leak investigation"] },
  { day: "THU", date: "20", visits: [] as string[] },
  { day: "FRI", date: "21", visits: ["Door alignment"] },
  { day: "SAT", date: "22", visits: [] as string[] },
  { day: "SUN", date: "23", visits: [] as string[] },
];

const publicAvailability = ["AVAILABLE", "LIMITED", "LIMITED", "AVAILABLE", "AVAILABLE", "EMERGENCY ONLY", "EMERGENCY ONLY"];

function CalendarScene({ progress }: { progress: number }) {
  const bookedReveal = Math.min(6, Math.floor(Math.min(1, progress / 0.52) * 7));
  const publicReveal = progress < 0.56 ? -1 : Math.min(6, Math.floor(((progress - 0.56) / 0.44) * 7));
  return (
    <div className="eli5-scene eli5-calendar-scene">
      <div className="eli5-calendar-head">
        <div><span>YOUR CALENDAR</span><strong>Booked work</strong></div>
        <div><small>WEEK VIEW</small><b>AUG 17–23, 2026</b></div>
      </div>
      <div className="eli5-calendar-controls"><b>WEEK</b><span>MONTH</span><span>‹</span><span>TODAY</span><span>›</span><i>6 VISITS IN VIEW</i></div>
      <div className="eli5-calendar-week">
        {weekVisits.map((day, index) => (
          <article key={day.day} className={index <= bookedReveal ? "is-revealed" : ""}>
            <header><small>{day.day}</small><b>{day.date}</b></header>
            <div className="eli5-calendar-day-body">
              {day.visits.length === 0 ? <em>No visits</em> : day.visits.map((visit, vIndex) => (
                <div className="eli5-booked-visit" key={visit}><small>{vIndex === 0 ? "9:00 AM" : vIndex === 1 ? "1:15 PM" : "3:40 PM"}</small><strong>{visit}</strong></div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="eli5-public-availability-head">
        <div><span>PUBLIC AVAILABILITY</span><strong>What customers see</strong></div>
        <b>PUBLIC ON</b>
      </div>
      <div className="eli5-public-week">
        {publicAvailability.map((status, index) => (
          <div key={`${status}-${index}`} className={index <= publicReveal ? "is-revealed" : ""}>
            <small>{weekVisits[index].day} {weekVisits[index].date}</small>
            <strong>{status}</strong><span>AUTOMATIC</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayScene({ progress }: { progress: number }) {
  const activeStop = Math.min(3, Math.floor(progress * 4));
  const stops = [
    { time: "8:30", client: "Theo Collins", job: "Sump pump problem", town: "Maplewood", x: 13, y: 68 },
    { time: "10:45", client: "Lena Collins", job: "Drywall repair", town: "Livingston", x: 39, y: 35 },
    { time: "1:15", client: "Grant Collins", job: "Ceiling water damage", town: "South Orange", x: 67, y: 59 },
    { time: "3:40", client: "Casey Collins", job: "Door alignment", town: "Montclair", x: 86, y: 24 },
  ];

  return (
    <div className="eli5-scene eli5-today-scene">
      <div className="eli5-today-week">
        <div><small>MON 17</small><b>0</b><span>VISITS</span></div>
        <div className="is-today"><small>TUE 18</small><b>4</b><span>VISITS</span></div>
        <div><small>WED 19</small><b>4</b><span>VISITS</span></div>
        <div><small>THU 20</small><b>2</b><span>VISITS</span></div>
        <div><small>FRI 21</small><b>1</b><span>VISIT</span></div>
      </div>
      <div className="eli5-route-layout">
        <div className="eli5-route-board">
          <div className="eli5-route-heading"><span>TRANSIT MAP · TODAY’S ROUTE</span><strong>4 stops · 32 miles</strong></div>
          <div className="eli5-route-map" aria-label="Illustrative transit map of today's visits">
            <svg viewBox="0 0 100 82" preserveAspectRatio="none" aria-hidden="true">
              <path className="map-road faint" d="M3 18 C20 11, 28 28, 42 18 S70 5, 96 13" />
              <path className="map-road faint" d="M5 73 C24 58, 35 71, 48 58 S78 45, 98 56" />
              <path className="map-road faint" d="M17 3 C24 21, 10 35, 20 52 S39 72, 34 81" />
              <path className="map-road faint" d="M70 2 C59 22, 78 35, 67 52 S58 72, 72 81" />
              <path className="map-route" d="M13 68 C22 49, 30 46, 39 35 C49 25, 56 53, 67 59 C76 64, 80 38, 86 24" />
            </svg>
            {stops.map((stop, index) => (
              <div key={stop.job} className={`eli5-map-stop ${index < activeStop ? "is-done" : ""} ${index === activeStop ? "is-current" : ""}`} style={{ left: `${stop.x}%`, top: `${stop.y}%` }}>
                <i>{index + 1}</i><span>{stop.town}</span>
              </div>
            ))}
            <div className="eli5-map-van" style={{ left: `${stops[activeStop].x}%`, top: `${stops[activeStop].y}%` }}>▰</div>
          </div>
        </div>
        <div className="eli5-stop-list">
          <div className="eli5-stop-list-head"><span>TUESDAY’S VISITS</span><b>4 SCHEDULED</b></div>
          {stops.map((stop, index) => (
            <article key={stop.job} className={`${index < activeStop ? "is-done" : ""} ${index === activeStop ? "is-current" : ""}`}>
              <time>{stop.time}</time>
              <div><small>{index === activeStop ? "CURRENT STOP" : index < activeStop ? "DONE" : `STOP ${index + 1}`}</small><strong>{stop.job}</strong><span>{stop.client} · {stop.town}</span></div>
              <b>{index < activeStop ? "✓" : index === activeStop ? "NOW" : "→"}</b>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

const vowCards = [
  { client: "PRIYA COLLINS", job: "Dead kitchen outlet", address: "20 Ridgefield Ave · West Orange", before: "/media/dead-kitchen-outlet/B-1.png", after: "/media/dead-kitchen-outlet/A-1.png", detail: "1 visit · 8 photos · Completed" },
  { client: "CASEY COLLINS", job: "Door alignment", address: "21 Forest Hill Rd · Montclair", before: "/media/door-alignment/B-1.png", after: "/media/door-alignment/A-1.png", detail: "1 cycle · Before + After" },
  { client: "THEO COLLINS", job: "Sump pump problem", address: "19 Maple Street · Maplewood", before: "/media/sump-pump-problem/B-1.png", after: "/media/sump-pump-problem/A-1.png", detail: "1 visit · Full photo record" },
];

function VowScene({ progress }: { progress: number }) {
  const selected = progress < 0.28 ? 0 : progress < 0.56 ? 1 : 2;
  const card = vowCards[selected];
  const [split, setSplit] = useState(52);
  return (
    <div className="eli5-scene eli5-vow-gallery-scene">
      <div className="eli5-vow-picker">
        <div className="eli5-vow-picker-head"><span>VOW LIBRARY</span><b>VISUAL RECORDS</b></div>
        {vowCards.map((item, index) => (
          <article className={index === selected ? "is-selected" : ""} key={item.job}>
            <div className="eli5-vow-thumb"><img src={item.after} alt={`${item.job} completed`} /></div>
            <div><small>{item.client}</small><strong>{item.job}</strong><span>{item.address}</span></div>
          </article>
        ))}
      </div>
      <div className="eli5-vow-proof">
        <div className="eli5-vow-proof-head"><div><span>VISUAL OF WORK</span><h3>{card.job}</h3><p>{card.client} · {card.address}</p></div><b>COMPLETED</b></div>
        <div className="eli5-vow-compare">
          <div className="eli5-vow-compare-stage">
            <img className="eli5-vow-compare-before" src={card.before} alt={`Before ${card.job}`} />
            <div className="eli5-vow-compare-after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
              <img src={card.after} alt={`After ${card.job}`} />
            </div>
            <span className="eli5-vow-compare-label is-before">BEFORE</span>
            <span className="eli5-vow-compare-label is-after">AFTER</span>
            <div className="eli5-vow-compare-divider" style={{ left: `${split}%` }} aria-hidden="true"><span>↔</span></div>
            <input
              className="eli5-vow-compare-range"
              type="range"
              min="8"
              max="92"
              value={split}
              aria-label={`Drag to compare before and after for ${card.job}`}
              onChange={(event) => setSplit(Number(event.currentTarget.value))}
            />
          </div>
          <div className="eli5-vow-compare-hint"><b>DRAG ↔</b><span>Compare the finished Job.</span></div>
        </div>
      </div>
    </div>
  );
}

function MarketingScene({ progress }: { progress: number }) {
  const sourceFocused = progress < 0.22;
  const active = sourceFocused ? -1 : progress < 0.48 ? 0 : progress < 0.74 ? 1 : 2;
  const formatLabel = active === 0 ? "INSTAGRAM POST" : active === 1 ? "FACEBOOK POST" : active === 2 ? "TIKTOK / REEL" : "READY";
  return (
    <div className="eli5-scene eli5-campaign-scene">
      <aside className={`eli5-campaign-source ${sourceFocused ? "is-featured" : ""}`}>
        <div className="eli5-campaign-source-label">VISUAL OF WORK</div>
        <div className="eli5-campaign-source-definition">The finished record of the Job.</div>
        <strong>Dead kitchen outlet</strong>
        <span>Priya Collins · West Orange, NJ</span>
        <div className="eli5-campaign-source-images">
          <figure><img src="/media/dead-kitchen-outlet/B-1.png" alt="Outlet before repair" /><figcaption>BEFORE</figcaption></figure>
          <figure><img src="/media/dead-kitchen-outlet/A-1.png" alt="Outlet after repair" /><figcaption>AFTER</figcaption></figure>
        </div>
        
        <div className="eli5-campaign-ready">CAMPAIGN READY <b>✓</b></div>
      </aside>

      <div className="eli5-campaign-output">
        <div className="eli5-campaign-topline"><span>PREBUILT MARKETING</span><b>VISUAL OF WORK → {formatLabel}</b></div>
        <div className="eli5-campaign-formats" aria-label="Marketing outputs">
          <span className={active === 0 ? "is-active" : ""}>INSTAGRAM</span>
          <span className={active === 1 ? "is-active" : ""}>FACEBOOK</span>
          <span className={active === 2 ? "is-active" : ""}>TIKTOK / REEL</span>
        </div>
        <div className="eli5-campaign-grid">
          <article className={`eli5-instagram-post ${active === 0 ? "is-featured" : ""}`}>
            <header>
              <div className="eli5-social-avatar">NL</div>
              <div><strong>northlinehome</strong><small>West Orange, New Jersey</small></div>
              <b>•••</b>
            </header>
            <div className="eli5-instagram-photo">
              <img src="/media/dead-kitchen-outlet/A-1.png" alt="Completed outlet repair Instagram post" />
              <span>1/2</span>
            </div>
            <div className="eli5-instagram-actions"><span>♡</span><span>◯</span><span>⌁</span><i>▱</i></div>
            <div className="eli5-instagram-copy">
              <b>northlinehome</b> Dead kitchen outlet → replaced, tested, and documented. Swipe for the before. <em>#WestOrangeNJ #HomeRepair #ElectricalRepair</em>
            </div>
          </article>

          <article className={`eli5-facebook-post ${active === 1 ? "is-featured" : ""}`}>
            <header>
              <div className="eli5-social-avatar">NL</div>
              <div><strong>Northline Home Services</strong><small>Sponsored · West Orange</small></div>
              <b>•••</b>
            </header>
            <p>Small repair. Big difference. This dead kitchen outlet was replaced, tested, and left clean—with the full before/after record attached to the Job.</p>
            <div className="eli5-facebook-pair">
              <figure><img src="/media/dead-kitchen-outlet/B-1.png" alt="Before outlet repair" /><figcaption>BEFORE</figcaption></figure>
              <figure><img src="/media/dead-kitchen-outlet/A-1.png" alt="After outlet repair" /><figcaption>AFTER</figcaption></figure>
            </div>
            <div className="eli5-facebook-meta"><span>👍 24</span><span>3 comments · 2 shares</span></div>
            <div className="eli5-facebook-actions"><b>Like</b><b>Comment</b><b>Share</b></div>
          </article>

          <article className={`eli5-story-post ${active === 2 ? "is-featured" : ""}`}>
            <img src="/media/dead-kitchen-outlet/A-1.png" alt="Finished outlet repair story creative" />
            <div className="eli5-story-shade" />
            <header><div className="eli5-social-avatar">NL</div><b>northlinehome</b><span>4h</span></header>
            <div className="eli5-story-copy"><small>WEST ORANGE · NJ</small><strong>DEAD OUTLET.<br/>FIXED + TESTED.</strong><p>Real work. Real proof.</p><button type="button">SEE THE WORK ↑</button></div>
          </article>
        </div>
      </div>
    </div>
  );
}


function NotesScene({ progress }: { progress: number }) {
  const query = progress < 0.2 ? "" : progress < 0.38 ? "roo" : "roof";
  const found = progress >= 0.38;
  const linked = progress >= 0.62;
  const notes = [
    { who: "Mara Collins", job: "Roof leak investigation", text: "Call after 4. Water mark spreading by back bedroom vent.", tag: "roof" },
    { who: "Theo Collins", job: "Sump pump problem", text: "Need 1/2 in. check valve before return trip.", tag: "part" },
    { who: "Priya Collins", job: "Dead kitchen outlet", text: "Customer wants outlet checked before Friday afternoon.", tag: "outlet" },
    { who: "Casey Collins", job: "Door alignment", text: "Hinge screws loose. Bring longer fasteners.", tag: "door" },
  ];
  return (
    <div className="eli5-scene eli5-notes-scene">
      <div className="eli5-notes-head">
        <div><span>NOTES & SCRAPS</span><strong>Search the work, not your phone.</strong></div>
        <label><small>FIND A NOTE</small><b>{query || "Type anything you remember…"}<i /></b></label>
      </div>
      <div className="eli5-notes-layout">
        <div className="eli5-note-stack">
          {notes.map((note, index) => {
            const match = !query || note.tag.includes(query);
            return (
              <article key={note.job} className={`${match ? "is-match" : "is-muted"} ${found && index === 0 ? "is-found" : ""}`}>
                <small>{note.who}</small>
                <strong>{note.job}</strong>
                <p>{note.text}</p>
              </article>
            );
          })}
        </div>
        <div className={`eli5-note-result ${found ? "is-visible" : ""} ${linked ? "is-linked" : ""}`}>
          <span>{linked ? "ATTACHED TO THE WORK" : "FOUND"}</span>
          <h3>Roof leak investigation</h3>
          <p>“Call after 4. Water mark spreading by back bedroom vent.”</p>
          <div className="eli5-note-facts">
            <div><small>CLIENT</small><b>Mara Collins</b></div>
            <div><small>PROPERTY</small><b>18 Cedar View Lane · South Orange</b></div>
            <div><small>JOB</small><b>Roof leak investigation · Cycle 2</b></div>
          </div>
          <div className="eli5-note-link-status">{linked ? "✓ NOTE KEPT WITH JOB HISTORY" : "MATCHING CONTEXT READY"}</div>
        </div>
      </div>
    </div>
  );
}

function MediaScene({ progress }: { progress: number }) {
  const query = progress < 0.22 ? "" : progress < 0.42 ? "out" : "outlet";
  const images = [
    ["/media/dead-kitchen-outlet/B-1.png", "BEFORE", "Priya Collins", "Dead kitchen outlet"],
    ["/media/dead-kitchen-outlet/D-1.png", "DURING", "Priya Collins", "Dead kitchen outlet"],
    ["/media/dead-kitchen-outlet/A-1.png", "AFTER", "Priya Collins", "Dead kitchen outlet"],
    ["/media/door-alignment/A-1.png", "AFTER", "Casey Collins", "Door alignment"],
  ];
  return (
    <div className="eli5-scene eli5-media-scene">
      <div className="eli5-media-toolbar"><div><span>MEDIA LIBRARY</span><h3>Project photos</h3></div><label>FIND MEDIA <strong>{query || "Type a client, Job, address…"}<i /></strong></label></div>
      <div className="eli5-media-grid">
        {images.map((image, index) => (
          <article key={image[0]} className={index === 3 && progress > 0.42 ? "is-muted" : ""}>
            <div className="eli5-photo-shell"><img src={image[0]} alt={`${image[1]} project photo`} /><b>{image[1]}</b></div>
            <small>{image[2]}</small><strong>{image[3]}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}

function DataScene({ progress }: { progress: number }) {
  const reporting = progress > 0.68;
  return (
    <div className={`eli5-scene eli5-data-scene eli5-data-scene-rich ${reporting ? "show-reporting" : ""}`}>
      <div className="eli5-data-stats eli5-data-stats-rich">
        <b><small>JOBS</small>21<span>3 completed</span></b>
        <b><small>CLIENTS</small>21<span>0 repeat</span></b>
        <b><small>COMPLETION</small>14%<span>of this view</span></b>
        <b><small>EVIDENCE READY</small>48%<span>Before + After</span></b>
        <b><small>MULTI-CYCLE</small>1<span>reopened / extended</span></b>
        <b><small>MEDIA</small>80<span>photos attached</span></b>
      </div>

      <div className="eli5-data-rich-grid">
        <section className="eli5-data-volume">
          <header><div><span>VOLUME</span><h3>Jobs over time</h3></div><small>CLICK A MONTH</small></header>
          <div className="eli5-rich-line"><svg viewBox="0 0 620 150" aria-hidden="true"><path d="M34 118 L178 96 L330 68 L470 52 L590 20 L590 132 L34 132 Z" fill="currentColor" opacity=".16"/><polyline points="34,118 178,96 330,68 470,52 590,20" fill="none" stroke="currentColor" strokeWidth="5"/><circle cx="34" cy="118" r="5"/><circle cx="590" cy="20" r="5"/></svg><b className="start">5</b><b className="end">16</b></div>
        </section>

        <section className="eli5-data-status">
          <header><span>STATUS</span><h3>What's happening now</h3></header>
          <div className="eli5-donut-wrap"><div className="eli5-donut eli5-status-donut"><b>21<small>JOBS</small></b></div><ul><li><i className="orange"/>Active <b>13</b></li><li><i className="dark"/>Cancelled <b>4</b></li><li><i className="gray"/>Completed <b>3</b></li><li><i className="paper"/>Archived <b>1</b></li></ul></div>
        </section>

        <section className="eli5-data-geo">
          <header><div><span>GEOGRAPHY</span><h3>Where you're working</h3></div><small>CLICK A TOWN</small></header>
          <div className="eli5-mini-bars">
            {[["West Orange",3],["Montclair",3],["Maplewood",3],["South Orange",3],["Bloomfield",3]].map(([name,count]) => <div key={String(name)}><b>{name}</b><span>{count}</span><i style={{width:"100%"}}/></div>)}
          </div>
        </section>

        <section className="eli5-data-mix">
          <header><div><span>WORK MIX</span><h3>What people hire you for</h3></div><small>CLICK A THEME</small></header>
          <div className="eli5-mix-grid">
            {[["WATER / LEAKS",7],["TRIM / CARPENTRY",7],["PAINT / FINISH",6],["DRYWALL / CEILING",5],["WINDOWS / DOORS",5],["ELECTRICAL",4],["DECK / EXTERIOR",4],["BATHROOM",4],["KITCHEN",2],["ROOFING",1]].map(([name,count]) => <div key={String(name)}><b>{name}</b><span>{count} Jobs</span><i style={{width:`${Number(count)*13}%`}}/></div>)}
          </div>
        </section>

        <section className="eli5-data-evidence">
          <header><div><span>EVIDENCE</span><h3>Are Jobs documented?</h3></div><small>CLICK COVERAGE</small></header>
          <div className="eli5-donut-wrap"><div className="eli5-donut eli5-evidence-donut"><b>21<small>JOBS</small></b></div><ul><li><i className="orange"/>Complete <b>10</b></li><li><i className="dark"/>Partial <b>0</b></li><li><i className="gray"/>None <b>11</b></li></ul></div>
        </section>

        <section className="eli5-data-repeat">
          <header><div><span>RELATIONSHIPS</span><h3>Who keeps coming back</h3></div><small>CLICK A CLIENT</small></header>
          <div className="eli5-mini-bars">{[["Priya Collins",1],["Casey Collins",1],["Nora Collins",1]].map(([name,count]) => <div key={String(name)}><b>{name}</b><span>{count}</span><i style={{width:"100%"}}/></div>)}</div>
        </section>
      </div>

      <div className="eli5-reporting-drawer eli5-reporting-drawer-rich">
        <div><span>REPORTING</span><h3>Filter the same 21 Jobs. Export what matters.</h3><p>Client · Town · Status · Keyword · Date · Evidence</p></div>
        <div className="eli5-report-actions"><b>FIELDS · 6</b><button type="button">EXPORT CSV</button><button type="button">EXPORT PDF</button></div>
      </div>
    </div>
  );
}

function DoneScene({ progress }: { progress: number }) {
  const items = [["MARKETING", "Publish finished work"], ["CALENDAR", "Book the work"], ["TODAY", "Follow the route"], ["VOW", "Keep the proof"], ["NOTES", "Find every scrap"], ["MEDIA", "Find every photo"], ["DATA", "See the business"]];
  return (
    <div className="eli5-scene eli5-done-scene">
      <div className="eli5-done-list">
        {items.map((item, index) => <div className={progress > index * 0.09 ? "is-visible" : ""} key={item[0]}><small>{item[0]}</small><strong>{item[1]}</strong><b>✓</b></div>)}
      </div>
      <div className={`eli5-done-summary ${progress > .48 ? "is-visible" : ""}`}><span>VIZOW</span><h3>Schedule it. Run it. Prove it. Reuse it. Understand it.</h3><p>Vizow keeps the work connected from the first request to the finished record.</p></div>
    </div>
  );
}

export function Eli5Page({ onGuidedWalkthrough }: { onGuidedWalkthrough: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>("slow");
  const [startingDemo, setStartingDemo] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [hasPrivateDemo, setHasPrivateDemo] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const finishedRef = useRef(false);
  const speedRef = useRef<PlaybackSpeed>("slow");

  const speedRate = (mode: PlaybackSpeed) => {
    if (mode === "slow") return 0.45;
    if (mode === "medium") return 1;
    return 1.65;
  };

  const tick = (now: number) => {
    if (pausedRef.current || finishedRef.current) {
      lastFrameRef.current = now;
      rafRef.current = window.requestAnimationFrame(tick);
      return;
    }

    if (lastFrameRef.current === null) lastFrameRef.current = now;
    const deltaSeconds = Math.max(0, (now - lastFrameRef.current) / 1000);
    lastFrameRef.current = now;

    const next = Math.min(TOTAL_SECONDS, elapsedRef.current + deltaSeconds * speedRate(speedRef.current));
    elapsedRef.current = next;
    setElapsed(next);

    if (next >= TOTAL_SECONDS) {
      finishedRef.current = true;
      pausedRef.current = true;
      setFinished(true);
      setPaused(true);
    }

    rafRef.current = window.requestAnimationFrame(tick);
  };

  useEffect(() => {
    const boot = window.setTimeout(() => {
      lastFrameRef.current = performance.now();
      rafRef.current = window.requestAnimationFrame(tick);
    }, 900);
    return () => {
      window.clearTimeout(boot);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setPlaybackSpeed = (nextSpeed: PlaybackSpeed) => {
    speedRef.current = nextSpeed;
    setSpeed(nextSpeed);
  };

  const togglePaused = () => {
    if (finishedRef.current) return;
    pausedRef.current = !pausedRef.current;
    lastFrameRef.current = performance.now();
    setPaused(pausedRef.current);
  };

  const replay = () => {
    elapsedRef.current = 0;
    lastFrameRef.current = performance.now();
    pausedRef.current = false;
    finishedRef.current = false;
    setElapsed(0);
    setFinished(false);
    setPaused(false);
    setPlaybackSpeed("slow");
  };

  const stage = getStage(elapsed);
  const stageProgress = useMemo(() => {
    const length = stage.end - stage.start;
    return Math.max(0, Math.min(1, (elapsed - stage.start) / length));
  }, [elapsed, stage]);
  const narration = getNarration(stage.id, stageProgress);
  const stageRemainingTourSeconds = Math.max(0, stage.end - elapsed);
  const stageRemainingRealSeconds = finished ? 0 : stageRemainingTourSeconds / speedRate(speed);
  const totalProgress = Math.min(100, (elapsed / TOTAL_SECONDS) * 100);

  const skipStage = () => {
    if (finishedRef.current) return;
    const current = getStage(elapsedRef.current);
    const nextElapsed = Math.min(TOTAL_SECONDS, current.end + 0.02);
    elapsedRef.current = nextElapsed;
    lastFrameRef.current = performance.now();
    setElapsed(nextElapsed);
    if (nextElapsed >= TOTAL_SECONDS) {
      finishedRef.current = true;
      pausedRef.current = true;
      setFinished(true);
      setPaused(true);
    }
  };

  const backStage = () => {
    const current = getStage(elapsedRef.current);
    const currentIndex = STAGES.findIndex((item) => item.id === current.id);
    if (currentIndex <= 0 && !finishedRef.current) return;
    const targetIndex = finishedRef.current ? STAGES.length - 2 : Math.max(0, currentIndex - 1);
    const targetElapsed = STAGES[targetIndex].start + 0.02;
    elapsedRef.current = targetElapsed;
    lastFrameRef.current = performance.now();
    finishedRef.current = false;
    pausedRef.current = false;
    setElapsed(targetElapsed);
    setFinished(false);
    setPaused(false);
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchDemoSessionStatus(controller.signal)
      .then((status) => setHasPrivateDemo(status.enabled && status.active))
      .catch(() => setHasPrivateDemo(false));

    return () => controller.abort();
  }, []);

  const resetDemo = async () => {
    if (startingDemo || resettingDemo) return;

    const confirmed = window.confirm(
      "Reset your private Vizow workspace? Your changes will be replaced with the clean starter demo.",
    );

    if (!confirmed) return;

    setResettingDemo(true);

    try {
      await resetPrivateDemo();
      setHasPrivateDemo(true);
      setResettingDemo(false);
      replay();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to reset your private Vizow demo.",
      );
      setResettingDemo(false);
    }
  };

  const jumpToStage = (target: Stage) => {
    const targetElapsed = target.start + 0.02;
    elapsedRef.current = targetElapsed;
    lastFrameRef.current = performance.now();
    finishedRef.current = false;
    pausedRef.current = false;
    setElapsed(targetElapsed);
    setFinished(false);
    setPaused(false);
  };

  const openPrivateDemo = async () => {
    if (startingDemo || resettingDemo) return;

    setStartingDemo(true);

    try {
      await startPrivateDemo();
      window.location.assign(defaultAppEntryPath());
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to start a private Vizow demo.",
      );
      setStartingDemo(false);
    }
  };

  return (
    <main className="eli5-page eli5-sixty-page">
      <header className="eli5-sixty-header">
        <Link to="/demo" className="eli5-sixty-logo">VIZOW</Link>
        <div className="eli5-sixty-promise"><span>ELI5</span><strong>Learn all you really need to know about Vizow in 60 seconds.</strong></div>
        <div className="eli5-demo-actions">
          <button
            type="button"
            className="eli5-walkthrough-link"
            onClick={onGuidedWalkthrough}
          >
            GUIDED WALKTHROUGH
          </button>
          {hasPrivateDemo ? (
            <button
              type="button"
              className="eli5-walkthrough-link"
              disabled={startingDemo || resettingDemo}
              onClick={() => void resetDemo()}
            >
              {resettingDemo ? "RESETTING…" : "RESET DEMO"}
            </button>
          ) : null}
          <button
            type="button"
            className="eli5-try-vizow"
            disabled={startingDemo || resettingDemo}
            onClick={() => void openPrivateDemo()}
          >
            {startingDemo
              ? "OPENING VIZOW…"
              : hasPrivateDemo ? "BACK TO VIZOW →" : "TRY VIZOW →"}
          </button>
        </div>
      </header>

      <nav className="eli5-stage-rail" aria-label="60 second Vizow tour stages">
        {STAGES.map((item) => {
          const active = item.id === stage.id;
          const complete = elapsed >= item.end;
          return (
            <button
              type="button"
              className={`${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
              key={item.id}
              onClick={() => jumpToStage(item)}
              aria-current={active ? "step" : undefined}
              title={`Jump to ${item.label}`}
            >
              <span>{item.label}</span><i />
            </button>
          );
        })}
        <div className="eli5-master-progress"><i style={{ width: `${totalProgress}%` }} /></div>
      </nav>

      <section className="eli5-sixty-stage">
        <div className="eli5-sixty-copy" key={stage.id}>
          <div className="eli5-slide-value">
            <span>{stage.label} · NOW</span>
            <h1 className="eli5-live-narration" key={narration.key}>
              {narration.key === "marketing-1" ? (
                <>
                  <span className="eli5-vow-intro-lead">Start with a finished</span>
                  <em className="eli5-vow-intro-name">Visual of Work.</em>
                </>
              ) : narration.title}
            </h1>
          </div>
          <div className="eli5-slide-controls">
            <div className="eli5-slide-clock" aria-live="polite">
              <small>{paused && !finished ? "PAUSED" : "NEXT"}</small>
              <b>{formatClock(stageRemainingRealSeconds)}</b>
            </div>
            <div className="eli5-speed-control" role="group" aria-label="Tour speed">
              <span>PACE</span>
              <button type="button" className={speed === "slow" ? "is-active" : ""} onClick={() => setPlaybackSpeed("slow")}>SLOW</button>
              <button type="button" className={speed === "medium" ? "is-active" : ""} onClick={() => setPlaybackSpeed("medium")}>MED</button>
              <button type="button" className={speed === "fast" ? "is-active" : ""} onClick={() => setPlaybackSpeed("fast")}>FAST</button>
            </div>
            <button type="button" onClick={backStage} disabled={!finished && STAGES.findIndex((item) => item.id === stage.id) === 0}>← BACK</button>
            <button type="button" onClick={finished ? replay : togglePaused}>{finished ? "REPLAY" : paused ? "RESUME" : "PAUSE"}</button>
            <button type="button" onClick={skipStage} disabled={finished}>SKIP →</button>
            <button type="button" onClick={onGuidedWalkthrough}>GUIDED →</button>
          </div>
        </div>
        <div className="eli5-sixty-demo" key={`${stage.id}-demo`}>
          {stage.id === "calendar" && <CalendarScene progress={stageProgress} />}
          {stage.id === "today" && <TodayScene progress={stageProgress} />}
          {stage.id === "vow" && <VowScene progress={stageProgress} />}
          {stage.id === "marketing" && <MarketingScene progress={stageProgress} />}
          {stage.id === "notes" && <NotesScene progress={stageProgress} />}
          {stage.id === "media" && <MediaScene progress={stageProgress} />}
          {stage.id === "data" && <DataScene progress={stageProgress} />}
          {stage.id === "done" && <DoneScene progress={stageProgress} />}
        </div>
      </section>

      {finished && <div className="eli5-finish-actions"><button type="button" onClick={replay}>REPLAY 60 SECONDS</button><button type="button" onClick={onGuidedWalkthrough}>GUIDED WALKTHROUGH →</button><button type="button" disabled={startingDemo || resettingDemo} onClick={() => void openPrivateDemo()}>{startingDemo ? "OPENING VIZOW…" : hasPrivateDemo ? "BACK TO VIZOW →" : "TRY VIZOW →"}</button></div>}

      <footer className="eli5-contact">
        <span>Questions or feedback?</span>
        <a href="mailto:emailjoshdicker@gmail.com">emailjoshdicker@gmail.com</a>
      </footer>
    </main>
  );
}
