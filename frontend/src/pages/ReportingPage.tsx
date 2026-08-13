import type { Job, MediaLibraryItem } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";
import { fetchJobs } from "../api/jobs";
import { fetchMediaLibrary } from "../api/media";
import { AppLayout } from "../layouts/AppLayout";
import "../styles/reporting-data.css";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; jobs: Job[]; media: MediaLibraryItem[] };
type FieldKey = "client" | "job" | "status" | "city" | "created" | "cycle" | "media";
const fields: Array<{ key: FieldKey; label: string }> = [
  { key: "client", label: "Client" }, { key: "job", label: "Job" }, { key: "status", label: "Status" },
  { key: "city", label: "City" }, { key: "created", label: "Created" }, { key: "cycle", label: "Cycle" }, { key: "media", label: "Media" },
];

function jobStatus(job: Job) {
  if (job.archivedAt) return "Archived";
  if (job.lifecycleStatus === "cancelled") return "Cancelled";
  return job.currentCycle.stage === "completed" ? "Completed" : "Active";
}
function shortDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }

export function ReportingPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [title, setTitle] = useState("Job activity report");
  const [client, setClient] = useState("all");
  const [city, setCity] = useState("all");
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(["client", "job", "status", "city", "created", "media"]);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchJobs(controller.signal, true), fetchMediaLibrary(controller.signal)])
      .then(([jobs, media]) => setState({ status: "ready", jobs, media }))
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load reporting data." }); });
    return () => controller.abort();
  }, []);

  const jobs = state.status === "ready" ? state.jobs : [];
  const media = state.status === "ready" ? state.media : [];
  const clients = useMemo(() => [...new Set(jobs.map((job) => job.clientName))].sort(), [jobs]);
  const cities = useMemo(() => [...new Set(jobs.map((job) => job.serviceCity).filter((value): value is string => Boolean(value)))].sort(), [jobs]);
  const mediaCount = useMemo(() => { const map = new Map<string, number>(); media.forEach((item) => map.set(item.jobId, (map.get(item.jobId) ?? 0) + 1)); return map; }, [media]);

  const filtered = useMemo(() => jobs.filter((job) => {
    const haystack = [job.clientName, job.title, job.description ?? "", job.serviceCity ?? "", job.serviceState ?? ""].join(" ").toLowerCase();
    const created = new Date(job.createdAt).getTime();
    if (client !== "all" && job.clientName !== client) return false;
    if (city !== "all" && job.serviceCity !== city) return false;
    if (status !== "all" && jobStatus(job).toLowerCase() !== status) return false;
    if (keyword.trim() && !haystack.includes(keyword.trim().toLowerCase())) return false;
    if (from && created < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && created > new Date(`${to}T23:59:59`).getTime()) return false;
    return true;
  }), [jobs, client, city, status, keyword, from, to]);

  const columns = selectedFields.map((key) => fields.find((field) => field.key === key)?.label ?? key);
  const rows = filtered.map((job) => {
    const values: Record<FieldKey, string> = {
      client: job.clientName, job: job.title, status: jobStatus(job), city: [job.serviceCity, job.serviceState].filter(Boolean).join(", "),
      created: shortDate(job.createdAt), cycle: `${job.currentCycle.cycleNumber} · ${job.currentCycle.stage}`, media: String(mediaCount.get(job.id) ?? 0),
    };
    return Object.fromEntries(selectedFields.map((key) => [fields.find((field) => field.key === key)?.label ?? key, values[key]]));
  });

  function downloadCsv() {
    const body = [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(","))].join("\n");
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "vizow-report"}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    setPdfBusy(true);
    try { const { downloadReportPdf } = await import("../pdf/report-pdf"); await downloadReportPdf(title, columns, rows); } finally { setPdfBusy(false); }
  }

  return (
    <AppLayout work="Reporting" client={client === "all" ? "All clients" : client} status="Build report" next={`${filtered.length} rows`}>
      <div className="page"><div className="shell insights-page">
        <header className="insights-title"><p className="eyebrow">Media · Reporting</p><h1>Build exactly the report you need.</h1><p>Choose the fields, narrow the work, preview it, then export a real CSV or PDF.</p></header>
        {state.status === "loading" ? <div className="panel">Loading reporting data…</div> : null}
        {state.status === "error" ? <div className="notice notice-error">{state.message}</div> : null}
        {state.status === "ready" ? <>
          <section className="report-builder panel">
            <div className="report-builder-row report-name-row"><label>Report title<input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="report-actions"><button className="btn" type="button" disabled={rows.length === 0} onClick={downloadCsv}>Export CSV</button><button className="btn btn-primary" type="button" disabled={rows.length === 0 || pdfBusy} onClick={() => void downloadPdf()}>{pdfBusy ? "Building PDF…" : "Export PDF"}</button></div></div>
            <div className="report-filter-grid">
              <label>Client<select className="select" value={client} onChange={(event) => setClient(event.target.value)}><option value="all">All clients</option>{clients.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>City<select className="select" value={city} onChange={(event) => setCity(event.target.value)}><option value="all">All cities</option>{cities.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Status<select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option></select></label>
              <label>Keyword<input className="input" placeholder="roof, outlet, trim…" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></label>
              <label>From<input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
              <label>To<input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
            </div>
            <div className="report-fields"><span>Columns</span>{fields.map((field) => <label key={field.key}><input type="checkbox" checked={selectedFields.includes(field.key)} onChange={() => setSelectedFields((current) => current.includes(field.key) ? current.filter((key) => key !== field.key) : [...current, field.key])} />{field.label}</label>)}</div>
          </section>
          <section className="report-preview panel"><div className="report-preview-head"><div><p className="eyebrow">Preview</p><h2>{title || "Untitled report"}</h2></div><strong>{filtered.length} Jobs</strong></div><div className="report-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.slice(0, 75).map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{row[column]}</td>)}</tr>)}</tbody></table></div>{rows.length > 75 ? <p className="report-preview-note">Previewing first 75 rows. Exports include all {rows.length} rows.</p> : null}</section>
        </> : null}
      </div></div>
    </AppLayout>
  );
}
