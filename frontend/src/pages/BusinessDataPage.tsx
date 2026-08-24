import type { Job, MediaLibraryItem } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";
import { fetchJobs } from "../api/jobs";
import { fetchMediaLibrary } from "../api/media";
import { WorkspaceHero } from "../components/WorkspaceHero";
import { AppLayout } from "../layouts/AppLayout";
import "../styles/reporting-data.css";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; jobs: Job[]; media: MediaLibraryItem[] };

type EvidenceFilter = "all" | "complete" | "partial" | "none";

type ThemeRule = {
  label: string;
  terms: string[];
};

const themeRules: ThemeRule[] = [
  { label: "Water / leaks", terms: ["water", "leak", "moisture", "flood", "sump", "drain"] },
  { label: "Electrical", terms: ["electrical", "electric", "outlet", "receptacle", "switch", "dimmer", "wiring"] },
  { label: "Drywall / ceiling", terms: ["drywall", "ceiling", "sheetrock", "wall", "patch"] },
  { label: "Deck / exterior", terms: ["deck", "stair", "exterior", "siding", "porch"] },
  { label: "Trim / carpentry", terms: ["trim", "carpentry", "wood", "cabinet", "door", "frame"] },
  { label: "Roofing", terms: ["roof", "shingle", "flashing", "chimney"] },
  { label: "Kitchen", terms: ["kitchen", "cabinet", "counter", "island"] },
  { label: "Bathroom", terms: ["bathroom", "bath", "fan", "vanity", "shower", "toilet"] },
  { label: "Paint / finish", terms: ["paint", "finish", "stain", "seal", "caulk"] },
  { label: "Windows / doors", terms: ["window", "door", "hinge", "alignment"] },
];

function statusOf(job: Job) {
  if (job.archivedAt) return "Archived";
  if (job.lifecycleStatus === "cancelled") return "Cancelled";
  return job.currentCycle.stage === "completed" ? "Completed" : "Active";
}

function countBy(values: string[]) {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function jobText(job: Job) {
  return [
    job.title,
    job.description ?? "",
    job.serviceCity ?? "",
    job.serviceState ?? "",
    job.servicePostalCode ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function themeMatches(job: Job, theme: ThemeRule) {
  const text = jobText(job);
  return theme.terms.some((term) => text.includes(term));
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

function monthRange(key: string) {
  const [year, month] = key.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
  };
}

function TrendChart({ rows, onPick }: { rows: Array<[string, number]>; onPick: (key: string) => void }) {
  if (!rows.length) return <div className="data-empty">No Jobs in this view.</div>;
  const width = 720;
  const height = 150;
  const padX = 26;
  const padY = 18;
  const max = Math.max(1, ...rows.map(([, value]) => value));
  const points = rows.map(([, value], index) => {
    const x = rows.length === 1 ? width / 2 : padX + (index / (rows.length - 1)) * (width - padX * 2);
    const y = height - padY - (value / max) * (height - padY * 2);
    return { x, y, value };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;

  return (
    <div className="data-trend-wrap">
      <svg className="data-trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Jobs created over time">
        <line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} className="data-chart-axis" />
        <polygon points={area} className="data-chart-area" />
        <polyline points={line} className="data-chart-line" />
        {points.map((point, index) => (
          <g key={rows[index][0]} className="data-chart-point" onClick={() => onPick(rows[index][0])}>
            <circle cx={point.x} cy={point.y} r="10" className="data-chart-point-hit" />
            <circle cx={point.x} cy={point.y} r="4.5" />
            <text x={point.x} y={Math.max(13, point.y - 10)} textAnchor="middle">{point.value}</text>
          </g>
        ))}
      </svg>
      <div className="data-trend-labels">
        {rows.map(([key]) => <button key={key} type="button" onClick={() => onPick(key)}>{monthLabel(key)}</button>)}
      </div>
    </div>
  );
}

function Donut({ rows }: { rows: Array<[string, number]> }) {
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  let cursor = 0;
  const segments = rows.map(([, value], index) => {
    const start = cursor;
    cursor += total ? (value / total) * 100 : 0;
    return `var(--data-chart-${index + 1}) ${start}% ${cursor}%`;
  });
  return (
    <div className="data-donut" style={{ background: total ? `conic-gradient(${segments.join(",")})` : "var(--color-paper)" }}>
      <div><strong>{total}</strong><span>Jobs</span></div>
    </div>
  );
}

function MiniBars({ rows, onPick }: { rows: Array<[string, number]>; onPick?: (label: string) => void }) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <div className="data-mini-bars">
      {rows.map(([label, value]) => (
        <button
          key={label}
          type="button"
          onClick={() => onPick?.(label)}
          disabled={!onPick || value === 0}
          className={value === 0 ? "is-zero" : ""}
        >
          <span><b>{label}</b><em>{value}</em></span>
          <i><u style={{ width: value === 0 ? "0%" : `${Math.max(4, (value / max) * 100)}%` }} /></i>
        </button>
      ))}
    </div>
  );
}

export function BusinessDataPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [client, setClient] = useState("all");
  const [city, setCity] = useState("all");
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [theme, setTheme] = useState("all");
  const [evidence, setEvidence] = useState<EvidenceFilter>("all");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchJobs(controller.signal, true), fetchMediaLibrary(controller.signal)])
      .then(([jobs, media]) => setState({ status: "ready", jobs, media }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load business data." });
        }
      });
    return () => controller.abort();
  }, []);

  const jobs = state.status === "ready" ? state.jobs : [];
  const media = state.status === "ready" ? state.media : [];
  const clientOptions = useMemo(() => [...new Set(jobs.map((job) => job.clientName))].sort(), [jobs]);
  const cityOptions = useMemo(
    () => [...new Set(jobs.map((job) => job.serviceCity).filter((value): value is string => Boolean(value)))].sort(),
    [jobs],
  );
  const mediaByJob = useMemo(() => {
    const map = new Map<string, Set<string>>();
    media.forEach((item) => {
      const stages = map.get(item.jobId) ?? new Set<string>();
      stages.add(item.stage.toLowerCase());
      map.set(item.jobId, stages);
    });
    return map;
  }, [media]);

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const text = `${job.clientName} ${jobText(job)}`;
    const created = new Date(job.createdAt).getTime();
    const stages = mediaByJob.get(job.id) ?? new Set<string>();
    const hasCompleteEvidence = stages.has("before") && stages.has("after");
    const hasAnyEvidence = stages.size > 0;
    if (client !== "all" && job.clientName !== client) return false;
    if (city !== "all" && job.serviceCity !== city) return false;
    if (status !== "all" && statusOf(job).toLowerCase() !== status) return false;
    if (keyword.trim() && !text.includes(keyword.toLowerCase().trim())) return false;
    if (from && created < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && created > new Date(`${to}T23:59:59`).getTime()) return false;
    if (theme !== "all") {
      const rule = themeRules.find((item) => item.label === theme);
      if (rule && !themeMatches(job, rule)) return false;
    }
    if (evidence === "complete" && !hasCompleteEvidence) return false;
    if (evidence === "partial" && (!hasAnyEvidence || hasCompleteEvidence)) return false;
    if (evidence === "none" && hasAnyEvidence) return false;
    return true;
  }), [jobs, mediaByJob, client, city, status, keyword, from, to, theme, evidence]);

  const themeContextJobs = useMemo(() => jobs.filter((job) => {
    const text = `${job.clientName} ${jobText(job)}`;
    const created = new Date(job.createdAt).getTime();
    const stages = mediaByJob.get(job.id) ?? new Set<string>();
    const hasCompleteEvidence = stages.has("before") && stages.has("after");
    const hasAnyEvidence = stages.size > 0;
    if (client !== "all" && job.clientName !== client) return false;
    if (city !== "all" && job.serviceCity !== city) return false;
    if (status !== "all" && statusOf(job).toLowerCase() !== status) return false;
    if (keyword.trim() && !text.includes(keyword.toLowerCase().trim())) return false;
    if (from && created < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && created > new Date(`${to}T23:59:59`).getTime()) return false;
    if (evidence === "complete" && !hasCompleteEvidence) return false;
    if (evidence === "partial" && (!hasAnyEvidence || hasCompleteEvidence)) return false;
    if (evidence === "none" && hasAnyEvidence) return false;
    return true;
  }), [jobs, mediaByJob, client, city, status, keyword, from, to, evidence]);

  const jobIds = useMemo(() => new Set(filteredJobs.map((job) => job.id)), [filteredJobs]);
  const filteredMedia = useMemo(() => media.filter((item) => jobIds.has(item.jobId)), [media, jobIds]);
  const uniqueClients = new Set(filteredJobs.map((job) => job.clientId)).size;
  const completed = filteredJobs.filter((job) => statusOf(job) === "Completed").length;
  const repeatClients = countBy(filteredJobs.map((job) => job.clientName)).filter(([, value]) => value > 1).length;
  const multiCycle = filteredJobs.filter((job) => job.currentCycle.cycleNumber > 1).length;
  const completeEvidence = filteredJobs.filter((job) => {
    const stages = mediaByJob.get(job.id) ?? new Set<string>();
    return stages.has("before") && stages.has("after");
  }).length;
  const completionRate = filteredJobs.length ? Math.round((completed / filteredJobs.length) * 100) : 0;
  const evidenceRate = filteredJobs.length ? Math.round((completeEvidence / filteredJobs.length) * 100) : 0;

  // Dashboard geometry is based on the whole business, not the current filter.
  // Filters change the values inside each instrument; they do not remove/reorder axes.
  const allStatusLabels = countBy(jobs.map(statusOf)).map(([label]) => label);
  const filteredStatusCounts = new Map(countBy(filteredJobs.map(statusOf)));
  const byStatus = allStatusLabels.map((label) => [label, filteredStatusCounts.get(label) ?? 0] as [string, number]);

  const allCityLabels = countBy(jobs.map((job) => job.serviceCity ?? "Unknown")).slice(0, 6).map(([label]) => label);
  const filteredCityCounts = new Map(countBy(filteredJobs.map((job) => job.serviceCity ?? "Unknown")));
  const byCity = allCityLabels.map((label) => [label, filteredCityCounts.get(label) ?? 0] as [string, number]);

  const allClientLabels = countBy(jobs.map((job) => job.clientName)).slice(0, 6).map(([label]) => label);
  const filteredClientCounts = new Map(countBy(filteredJobs.map((job) => job.clientName)));
  const byClient = allClientLabels.map((label) => [label, filteredClientCounts.get(label) ?? 0] as [string, number]);

  const allMonthLabels = countBy(jobs.map((job) => job.createdAt.slice(0, 7)))
    .map(([label]) => label)
    .sort((a, b) => a.localeCompare(b))
    .slice(-8);
  const filteredMonthCounts = new Map(countBy(filteredJobs.map((job) => job.createdAt.slice(0, 7))));
  const byMonth = allMonthLabels.map((label) => [label, filteredMonthCounts.get(label) ?? 0] as [string, number]);

  // Keep Work Mix spatially stable while filters change.
  // Categories and order come from the full business dataset; only the counts update.
  const allThemeRows = themeRules
    .map((rule) => [rule.label, jobs.filter((job) => themeMatches(job, rule)).length] as [string, number])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const filteredThemeCount = new Map(
    themeRules.map((rule) => [rule.label, themeContextJobs.filter((job) => themeMatches(job, rule)).length] as [string, number]),
  );
  const themeRows = allThemeRows.map(([label, total]) => ({
    label,
    total,
    value: filteredThemeCount.get(label) ?? 0,
  }));
  const maxThemeTotal = Math.max(1, ...allThemeRows.map(([, value]) => value));

  const evidenceRows: Array<[string, number]> = [
    ["Complete", completeEvidence],
    ["Partial", filteredJobs.filter((job) => {
      const stages = mediaByJob.get(job.id) ?? new Set<string>();
      return stages.size > 0 && !(stages.has("before") && stages.has("after"));
    }).length],
    ["None", filteredJobs.filter((job) => (mediaByJob.get(job.id)?.size ?? 0) === 0).length],
  ];

  const filteredStageCounts = new Map(countBy(filteredMedia.map((item) => item.stage.toLowerCase())));
  const stageRows: Array<[string, number]> = [
    ["Before", filteredStageCounts.get("before") ?? 0],
    ["During", filteredStageCounts.get("during") ?? 0],
    ["After", filteredStageCounts.get("after") ?? 0],
  ];

  const cycleRows: Array<[string, number]> = [
    ["1 cycle", filteredJobs.filter((job) => job.currentCycle.cycleNumber === 1).length],
    ["2 cycles", filteredJobs.filter((job) => job.currentCycle.cycleNumber === 2).length],
    ["3+ cycles", filteredJobs.filter((job) => job.currentCycle.cycleNumber >= 3).length],
  ];

  function reset() {
    setClient("all");
    setCity("all");
    setStatus("all");
    setKeyword("");
    setFrom("");
    setTo("");
    setTheme("all");
    setEvidence("all");
  }

  function pickMonth(key: string) {
    const range = monthRange(key);
    setFrom(range.from);
    setTo(range.to);
  }

  const hasFilters = client !== "all" || city !== "all" || status !== "all" || keyword || from || to || theme !== "all" || evidence !== "all";

  return (
    <AppLayout
      work="Business data"
      client={client === "all" ? "All clients" : client}
      status={hasFilters ? "Filtered" : "All data"}
      next={`${filteredJobs.length} Jobs`}
    >
      <div className="page">
        <div className="shell workspace-canonical-page insights-page data-storyboard data-canonical-page">
          <WorkspaceHero
            eyebrow="Media · Data"
            title="Data"
            description="See the business you have been too busy to see. Every chart is the same Jobs and evidence viewed from a different angle."
            metrics={[
              { label: "Jobs in view", value: filteredJobs.length },
              { label: "Clients", value: uniqueClients },
              { label: "Media", value: filteredMedia.length },
            ]}
          />

          {state.status === "loading" ? <div className="panel">Loading business data…</div> : null}
          {state.status === "error" ? <div className="notice notice-error">{state.message}</div> : null}
          {state.status === "ready" ? <>
            <section className="data-filter-surface" aria-label="Business data filters">
              <header className="data-filter-heading"><div><p className="workspace-eyebrow">Explore</p><h2>Filter the business</h2></div><span>{filteredJobs.length} Jobs in view</span></header>
              <div className="data-command-bar">
              <label>Client<select className="select" value={client} onChange={(event) => setClient(event.target.value)}><option value="all">All clients</option>{clientOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Town<select className="select" value={city} onChange={(event) => setCity(event.target.value)}><option value="all">All towns</option>{cityOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Status<select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option></select></label>
              <label className="data-command-keyword">Keyword<input className="input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="deck, water, outlet…" /></label>
              <label>From<input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
              <label>To<input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
              <button className="btn data-clear" type="button" onClick={reset} disabled={!hasFilters}>Clear</button>
              </div>
            </section>

            <div className={`data-active-filters${hasFilters ? "" : " is-empty"}`} aria-hidden={!hasFilters}>
              <span>Showing</span>
              {client !== "all" ? <button type="button" onClick={() => setClient("all")}>Client · {client} ×</button> : null}
              {city !== "all" ? <button type="button" onClick={() => setCity("all")}>Town · {city} ×</button> : null}
              {status !== "all" ? <button type="button" onClick={() => setStatus("all")}>Status · {status} ×</button> : null}
              {keyword ? <button type="button" onClick={() => setKeyword("")}>Keyword · {keyword} ×</button> : null}
              {theme !== "all" ? <button type="button" onClick={() => setTheme("all")}>Work · {theme} ×</button> : null}
              {evidence !== "all" ? <button type="button" onClick={() => setEvidence("all")}>Evidence · {evidence} ×</button> : null}
              {from || to ? <button type="button" onClick={() => { setFrom(""); setTo(""); }}>Dates ×</button> : null}
            </div>

            <section className="data-kpi-ribbon data-kpi-ribbon-secondary">
              <article><span>Completion</span><strong>{completionRate}%</strong><small>{completed} completed</small></article>
              <article><span>Evidence ready</span><strong>{evidenceRate}%</strong><small>Before + After</small></article>
              <article><span>Repeat clients</span><strong>{repeatClients}</strong><small>more than one Job</small></article>
              <article><span>Multi-cycle</span><strong>{multiCycle}</strong><small>reopened / extended</small></article>
            </section>

            <section className="data-visual-board">
              <article className="data-chart-card data-chart-trend">
                <header><div><p className="eyebrow">Volume</p><h2>Jobs over time</h2></div><span>Click a month</span></header>
                <TrendChart rows={byMonth} onPick={pickMonth} />
              </article>

              <article className="data-chart-card data-chart-status">
                <header><div><p className="eyebrow">Status</p><h2>What's happening now</h2></div></header>
                <div className="data-donut-layout">
                  <Donut rows={byStatus} />
                  <div className="data-donut-legend">
                    {byStatus.map(([label, value], index) => <button key={label} type="button" onClick={() => setStatus(label.toLowerCase())}><i className={`data-swatch data-swatch-${index + 1}`} /><span>{label}</span><b>{value}</b></button>)}
                  </div>
                </div>
                <div className="data-cycle-strip"><span>Cycle complexity</span>{cycleRows.map(([label, value]) => <b key={label} className={value === 0 ? "is-zero" : ""}>{label} <em>{value}</em></b>)}</div>
              </article>

              <article className="data-chart-card">
                <header><div><p className="eyebrow">Geography</p><h2>Where you're working</h2></div><span>Click a town</span></header>
                <MiniBars rows={byCity} onPick={(value) => value !== "Unknown" && setCity(value)} />
              </article>

              <article className="data-chart-card data-chart-themes">
                <header><div><p className="eyebrow">Work mix</p><h2>What people hire you for</h2></div><span>Click a theme</span></header>
                <div className={`data-theme-map data-theme-map-${Math.min(themeRows.length, 10)}`}>
                  {themeRows.length ? themeRows.map(({ label, value, total }) => {
                    const percent = Math.round((value / maxThemeTotal) * 100);
                    const isSelected = theme === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`${isSelected ? "is-selected" : ""} ${value === 0 ? "is-zero" : ""}`.trim()}
                        onClick={() => setTheme(isSelected ? "all" : label)}
                        disabled={total === 0}
                        aria-pressed={isSelected}
                        title={hasFilters ? `${value} of ${total} Jobs in this view` : `${total} Jobs`}
                      >
                        <strong>{label}</strong>
                        <span>{hasFilters ? `${value} / ${total}` : value} {value === 1 && !hasFilters ? "Job" : "Jobs"}</span>
                        <i className="data-theme-meter" aria-hidden="true"><u style={{ width: `${percent}%` }} /></i>
                      </button>
                    );
                  }) : <div className="data-empty">No clear work themes in the business yet.</div>}
                </div>
              </article>

              <article className="data-chart-card">
                <header><div><p className="eyebrow">Evidence</p><h2>Are Jobs documented?</h2></div><span>Click coverage</span></header>
                <div className="data-evidence-grid">
                  <Donut rows={evidenceRows} />
                  <div className="data-donut-legend">
                    {evidenceRows.map(([label, value], index) => <button key={label} type="button" onClick={() => setEvidence(label.toLowerCase() as EvidenceFilter)}><i className={`data-swatch data-swatch-${index + 1}`} /><span>{label}</span><b>{value}</b></button>)}
                  </div>
                </div>
                <div className="data-stage-strip">{stageRows.map(([label, value]) => <span key={label}><b>{label}</b><em>{value}</em></span>)}</div>
              </article>

              <article className="data-chart-card data-chart-relationships">
                <header><div><p className="eyebrow">Relationships</p><h2>Who keeps coming back</h2></div><span>Click a client</span></header>
                <MiniBars rows={byClient} onPick={setClient} />
              </article>
            </section>
          </> : null}
        </div>
      </div>
    </AppLayout>
  );
}
