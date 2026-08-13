import type { Job, MediaLibraryItem } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";
import { fetchJobs } from "../api/jobs";
import { fetchMediaLibrary } from "../api/media";
import { AppLayout } from "../layouts/AppLayout";
import "../styles/reporting-data.css";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; jobs: Job[]; media: MediaLibraryItem[] };
function statusOf(job: Job) { if (job.archivedAt) return "Archived"; if (job.lifecycleStatus === "cancelled") return "Cancelled"; return job.currentCycle.stage === "completed" ? "Completed" : "Active"; }
function countBy(values: string[]) { const map = new Map<string, number>(); values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1)); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
const stop = new Set(["the","a","an","and","or","to","of","for","in","on","with","repair","replace","replacement","job","work"]);

function BarList({ rows, max, onPick }: { rows: Array<[string, number]>; max: number; onPick?: (value: string) => void }) {
  return <div className="data-bars">{rows.map(([label, value]) => <button key={label} type="button" onClick={() => onPick?.(label)} disabled={!onPick}><span><b>{label}</b><em>{value}</em></span><i><u style={{ width: `${Math.max(4, (value / Math.max(1, max)) * 100)}%` }} /></i></button>)}</div>;
}

export function BusinessDataPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [client, setClient] = useState("all");
  const [city, setCity] = useState("all");
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchJobs(controller.signal, true), fetchMediaLibrary(controller.signal)])
      .then(([jobs, media]) => setState({ status: "ready", jobs, media }))
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load business data." }); });
    return () => controller.abort();
  }, []);

  const jobs = state.status === "ready" ? state.jobs : [];
  const media = state.status === "ready" ? state.media : [];
  const clientOptions = useMemo(() => [...new Set(jobs.map((job) => job.clientName))].sort(), [jobs]);
  const cityOptions = useMemo(() => [...new Set(jobs.map((job) => job.serviceCity).filter((value): value is string => Boolean(value)))].sort(), [jobs]);

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const haystack = [job.clientName, job.title, job.description ?? "", job.serviceCity ?? "", job.serviceState ?? ""].join(" ").toLowerCase();
    const created = new Date(job.createdAt).getTime();
    if (client !== "all" && job.clientName !== client) return false;
    if (city !== "all" && job.serviceCity !== city) return false;
    if (status !== "all" && statusOf(job).toLowerCase() !== status) return false;
    if (keyword.trim() && !haystack.includes(keyword.toLowerCase().trim())) return false;
    if (from && created < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && created > new Date(`${to}T23:59:59`).getTime()) return false;
    return true;
  }), [jobs, client, city, status, keyword, from, to]);

  const jobIds = useMemo(() => new Set(filteredJobs.map((job) => job.id)), [filteredJobs]);
  const filteredMedia = useMemo(() => media.filter((item) => jobIds.has(item.jobId)), [media, jobIds]);
  const uniqueClients = new Set(filteredJobs.map((job) => job.clientId)).size;
  const uniqueCities = new Set(filteredJobs.map((job) => job.serviceCity).filter(Boolean)).size;
  const completed = filteredJobs.filter((job) => statusOf(job) === "Completed").length;
  const active = filteredJobs.filter((job) => statusOf(job) === "Active").length;
  const conversion = filteredJobs.length ? Math.round((completed / filteredJobs.length) * 100) : 0;

  const byClient = countBy(filteredJobs.map((job) => job.clientName)).slice(0, 8);
  const byCity = countBy(filteredJobs.map((job) => job.serviceCity ?? "Unknown")).slice(0, 8);
  const byStatus = countBy(filteredJobs.map(statusOf));
  const mediaStages = countBy(filteredMedia.map((item) => item.stage));
  const keywords = countBy(filteredJobs.flatMap((job) => `${job.title} ${job.description ?? ""}`.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !stop.has(word)))).slice(0, 10);
  const maxClient = Math.max(1, ...byClient.map(([, value]) => value));
  const maxCity = Math.max(1, ...byCity.map(([, value]) => value));
  const maxStatus = Math.max(1, ...byStatus.map(([, value]) => value));
  const maxMedia = Math.max(1, ...mediaStages.map(([, value]) => value));
  const maxKeyword = Math.max(1, ...keywords.map(([, value]) => value));

  function reset() { setClient("all"); setCity("all"); setStatus("all"); setKeyword(""); setFrom(""); setTo(""); }

  return (
    <AppLayout work="Business data" client={client === "all" ? "All clients" : client} status="Explore" next={`${filteredJobs.length} Jobs`}>
      <div className="page"><div className="shell insights-page">
        <header className="insights-title"><p className="eyebrow">Media · Data</p><h1>Understand the business without becoming a data analyst.</h1><p>Everything is clickable, filterable, and grounded in the Jobs and media already in Vizow.</p></header>
        {state.status === "loading" ? <div className="panel">Loading business data…</div> : null}
        {state.status === "error" ? <div className="notice notice-error">{state.message}</div> : null}
        {state.status === "ready" ? <>
          <section className="data-filter-bar panel">
            <label>Client<select className="select" value={client} onChange={(event) => setClient(event.target.value)}><option value="all">All clients</option>{clientOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>City<select className="select" value={city} onChange={(event) => setCity(event.target.value)}><option value="all">All cities</option>{cityOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Status<select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option></select></label>
            <label>Keyword<input className="input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="outlet, roof, trim…" /></label>
            <label>From<input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>To<input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
            <button className="btn" type="button" onClick={reset}>Clear</button>
          </section>

          <section className="data-kpis">
            <article><span>Jobs</span><strong>{filteredJobs.length}</strong><small>{active} active · {completed} completed</small></article>
            <article><span>Clients</span><strong>{uniqueClients}</strong><small>in this view</small></article>
            <article><span>Cities</span><strong>{uniqueCities}</strong><small>service locations</small></article>
            <article><span>Media</span><strong>{filteredMedia.length}</strong><small>attached evidence</small></article>
            <article><span>Completed</span><strong>{conversion}%</strong><small>of filtered Jobs</small></article>
          </section>

          <section className="data-dashboard-grid">
            <article className="panel"><header><p className="eyebrow">Clients</p><h2>Where the work comes from</h2></header><BarList rows={byClient} max={maxClient} onPick={(value) => setClient(value)} /></article>
            <article className="panel"><header><p className="eyebrow">Cities</p><h2>Where you're working</h2></header><BarList rows={byCity} max={maxCity} onPick={(value) => value !== "Unknown" && setCity(value)} /></article>
            <article className="panel"><header><p className="eyebrow">Status</p><h2>What's happening now</h2></header><BarList rows={byStatus} max={maxStatus} onPick={(value) => setStatus(value.toLowerCase())} /></article>
            <article className="panel"><header><p className="eyebrow">Media</p><h2>Evidence coverage</h2></header><BarList rows={mediaStages.map(([label, value]) => [label[0].toUpperCase() + label.slice(1), value])} max={maxMedia} /></article>
            <article className="panel data-wide"><header><p className="eyebrow">Keywords</p><h2>What people keep hiring you for</h2></header><div className="keyword-cloud">{keywords.map(([label, value]) => <button key={label} type="button" style={{ fontSize: `${0.72 + (value / maxKeyword) * 0.72}rem` }} onClick={() => setKeyword(label)}>{label}<span>{value}</span></button>)}</div></article>
          </section>
        </> : null}
      </div></div>
    </AppLayout>
  );
}
