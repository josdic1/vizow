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

type FieldGroup = "Core" | "Location" | "Lifecycle" | "Evidence" | "Derived";
type FieldKey =
  | "client"
  | "job"
  | "description"
  | "status"
  | "lifecycle"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "created"
  | "updated"
  | "daysOpen"
  | "clientJobs"
  | "cycleNumber"
  | "cycleReason"
  | "cycleStage"
  | "cycleOpened"
  | "cycleCompleted"
  | "media"
  | "before"
  | "during"
  | "after"
  | "evidence"
  | "mediaNotes";

type FieldDefinition = { key: FieldKey; label: string; group: FieldGroup };
type EvidenceStats = { total: number; before: number; during: number; after: number; notes: string[] };
type DocumentType = "invoice" | "sow" | "proposal";

const fields: FieldDefinition[] = [
  { key: "client", label: "Client", group: "Core" },
  { key: "job", label: "Job", group: "Core" },
  { key: "description", label: "Description", group: "Core" },
  { key: "status", label: "Status", group: "Core" },
  { key: "created", label: "Created", group: "Core" },
  { key: "updated", label: "Last activity", group: "Core" },

  { key: "address", label: "Property", group: "Location" },
  { key: "city", label: "Town", group: "Location" },
  { key: "state", label: "State", group: "Location" },
  { key: "zip", label: "ZIP", group: "Location" },

  { key: "lifecycle", label: "Lifecycle", group: "Lifecycle" },
  { key: "cycleNumber", label: "Cycle #", group: "Lifecycle" },
  { key: "cycleReason", label: "Cycle reason", group: "Lifecycle" },
  { key: "cycleStage", label: "Cycle stage", group: "Lifecycle" },
  { key: "cycleOpened", label: "Cycle opened", group: "Lifecycle" },
  { key: "cycleCompleted", label: "Cycle completed", group: "Lifecycle" },

  { key: "media", label: "Total media", group: "Evidence" },
  { key: "before", label: "Before", group: "Evidence" },
  { key: "during", label: "During", group: "Evidence" },
  { key: "after", label: "After", group: "Evidence" },
  { key: "evidence", label: "Evidence coverage", group: "Evidence" },
  { key: "mediaNotes", label: "Media notes", group: "Evidence" },

  { key: "daysOpen", label: "Days open", group: "Derived" },
  { key: "clientJobs", label: "Client Job count", group: "Derived" },
];

const fieldGroups: FieldGroup[] = ["Core", "Location", "Lifecycle", "Evidence", "Derived"];
const defaultFields: FieldKey[] = ["client", "job", "status", "city", "created", "cycleStage", "media", "evidence"];

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function jobStatus(job: Job) {
  if (job.archivedAt) return "Archived";
  if (job.lifecycleStatus === "cancelled") return "Cancelled";
  return job.currentCycle.stage === "completed" ? "Completed" : "Active";
}

function shortDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function fullAddress(job: Job) {
  return [job.serviceAddressLine1, job.serviceAddressLine2, job.serviceCity, job.serviceState, job.servicePostalCode]
    .filter(Boolean)
    .join(", ");
}

function cityStateZip(job: Job) {
  const cityState = [job.serviceCity, job.serviceState].filter(Boolean).join(", ");
  return [cityState, job.servicePostalCode].filter(Boolean).join(" ");
}

function evidenceLabel(stats: EvidenceStats) {
  if (stats.total === 0) return "None";
  if (stats.before > 0 && stats.after > 0) return "Before + After";
  if (stats.before === 0 && stats.after === 0) return "During only";
  if (stats.before === 0) return "Missing Before";
  return "Missing After";
}

function daysBetween(start: string, end: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "—";
  return String(Math.max(0, Math.ceil((endMs - startMs) / 86_400_000)));
}

function defaultTerms(type: DocumentType) {
  if (type === "invoice") return "Payment terms: due upon receipt. Review the Job record and supporting evidence for the work represented here.";
  if (type === "proposal") return "This proposal reflects the work currently described in the Vizow Job. Final scope and pricing require approval before work begins.";
  return "This scope of work reflects the work currently represented in the Vizow Job record. Changes should be documented as scope revisions.";
}

export function ReportingPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [title, setTitle] = useState("Job activity report");
  const [client, setClient] = useState("all");
  const [city, setCity] = useState("all");
  const [status, setStatus] = useState("all");
  const [evidence, setEvidence] = useState("all");
  const [cycles, setCycles] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(defaultFields);
  const [showFields, setShowFields] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [documentScope, setDocumentScope] = useState("");
  const [documentAmount, setDocumentAmount] = useState("");
  const [documentTerms, setDocumentTerms] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [documentPdfBusy, setDocumentPdfBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchJobs(controller.signal, true), fetchMediaLibrary(controller.signal)])
      .then(([jobs, media]) => setState({ status: "ready", jobs, media }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load reporting data." });
        }
      });
    return () => controller.abort();
  }, []);

  const jobs = state.status === "ready" ? state.jobs : [];
  const media = state.status === "ready" ? state.media : [];
  const clients = useMemo(() => [...new Set(jobs.map((job) => job.clientName))].sort(), [jobs]);
  const cities = useMemo(
    () => [...new Set(jobs.map((job) => job.serviceCity).filter((value): value is string => Boolean(value)))].sort(),
    [jobs],
  );

  const clientJobCounts = useMemo(() => {
    const counts = new Map<string, number>();
    jobs.forEach((job) => counts.set(job.clientId, (counts.get(job.clientId) ?? 0) + 1));
    return counts;
  }, [jobs]);

  const mediaStats = useMemo(() => {
    const map = new Map<string, EvidenceStats>();
    media.forEach((item) => {
      const current = map.get(item.jobId) ?? { total: 0, before: 0, during: 0, after: 0, notes: [] };
      current.total += 1;
      if (item.stage === "before") current.before += 1;
      if (item.stage === "during") current.during += 1;
      if (item.stage === "after") current.after += 1;
      const note = item.attachedNote?.trim() || item.caption?.trim();
      if (note && !current.notes.includes(note)) current.notes.push(note);
      map.set(item.jobId, current);
    });
    return map;
  }, [media]);

  const emptyEvidence: EvidenceStats = useMemo(() => ({ total: 0, before: 0, during: 0, after: 0, notes: [] }), []);

  const filtered = useMemo(() => {
    const result = jobs.filter((job) => {
      const stats = mediaStats.get(job.id) ?? emptyEvidence;
      const haystack = [
        job.clientName,
        job.title,
        job.description ?? "",
        job.serviceAddressLine1 ?? "",
        job.serviceAddressLine2 ?? "",
        job.serviceCity ?? "",
        job.serviceState ?? "",
        job.servicePostalCode ?? "",
        titleCase(job.lifecycleStatus),
        titleCase(job.currentCycle.stage),
        titleCase(job.currentCycle.reason),
        ...stats.notes,
      ]
        .join(" ")
        .toLowerCase();
      const created = new Date(job.createdAt).getTime();
      const evidenceState = evidenceLabel(stats);

      if (client !== "all" && job.clientName !== client) return false;
      if (city !== "all" && job.serviceCity !== city) return false;
      if (status !== "all" && jobStatus(job).toLowerCase() !== status) return false;
      if (evidence !== "all" && evidenceState !== evidence) return false;
      if (cycles === "one" && job.currentCycle.cycleNumber !== 1) return false;
      if (cycles === "multi" && job.currentCycle.cycleNumber < 2) return false;
      if (keyword.trim() && !haystack.includes(keyword.trim().toLowerCase())) return false;
      if (from && created < new Date(`${from}T00:00:00`).getTime()) return false;
      if (to && created > new Date(`${to}T23:59:59`).getTime()) return false;
      return true;
    });

    return [...result].sort((a, b) => {
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "client") return a.clientName.localeCompare(b.clientName) || a.title.localeCompare(b.title);
      if (sort === "town") return (a.serviceCity ?? "").localeCompare(b.serviceCity ?? "") || a.title.localeCompare(b.title);
      if (sort === "status") return jobStatus(a).localeCompare(jobStatus(b)) || a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [jobs, mediaStats, emptyEvidence, client, city, status, evidence, cycles, keyword, from, to, sort]);

  function fieldValue(job: Job, key: FieldKey) {
    const stats = mediaStats.get(job.id) ?? emptyEvidence;
    const values: Record<FieldKey, string> = {
      client: job.clientName,
      job: job.title,
      description: job.description ?? "—",
      status: jobStatus(job),
      lifecycle: titleCase(job.lifecycleStatus),
      address: fullAddress(job) || "—",
      city: job.serviceCity ?? "—",
      state: job.serviceState ?? "—",
      zip: job.servicePostalCode ?? "—",
      created: shortDate(job.createdAt),
      updated: shortDate(job.updatedAt),
      daysOpen: daysBetween(job.createdAt, job.currentCycle.completedAt),
      clientJobs: String(clientJobCounts.get(job.clientId) ?? 1),
      cycleNumber: String(job.currentCycle.cycleNumber),
      cycleReason: titleCase(job.currentCycle.reason),
      cycleStage: titleCase(job.currentCycle.stage),
      cycleOpened: shortDate(job.currentCycle.openedAt),
      cycleCompleted: shortDate(job.currentCycle.completedAt),
      media: String(stats.total),
      before: String(stats.before),
      during: String(stats.during),
      after: String(stats.after),
      evidence: evidenceLabel(stats),
      mediaNotes: stats.notes.join(" · ") || "—",
    };
    return values[key];
  }

  const columns = selectedFields.map((key) => fields.find((field) => field.key === key)?.label ?? key);
  const rows = filtered.map((job) =>
    Object.fromEntries(
      selectedFields.map((key) => [fields.find((field) => field.key === key)?.label ?? key, fieldValue(job, key)]),
    ),
  );

  const selectedJobs = useMemo(
    () => jobs.filter((job) => selectedJobIds.includes(job.id)),
    [jobs, selectedJobIds],
  );
  const selectedJob = selectedJobs.length === 1 ? selectedJobs[0] : null;
  const visibleIds = filtered.map((job) => job.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedJobIds.includes(id));

  function toggleSelectedJob(id: string) {
    setSelectedJobIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
    setDocumentType(null);
  }

  function toggleVisibleSelection() {
    setSelectedJobIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])];
    });
    setDocumentType(null);
  }

  function clearFilters() {
    setClient("all");
    setCity("all");
    setStatus("all");
    setEvidence("all");
    setCycles("all");
    setKeyword("");
    setFrom("");
    setTo("");
    setSort("newest");
  }

  function openDocument(type: DocumentType) {
    if (!selectedJob) return;
    setDocumentType(type);
    setDocumentScope(selectedJob.description?.trim() || selectedJob.title);
    setDocumentAmount("");
    setDocumentTerms(defaultTerms(type));
    setCreateMenuOpen(false);
  }

  function downloadCsv() {
    const body = [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(","))].join("\n");
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "vizow-report"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const { downloadReportPdf } = await import("../pdf/report-pdf");
      await downloadReportPdf(title, columns, rows);
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadDocumentPdf() {
    if (!selectedJob || !documentType) return;
    setDocumentPdfBusy(true);
    try {
      const stats = mediaStats.get(selectedJob.id) ?? emptyEvidence;
      const amount = documentAmount.trim() === "" ? null : Number(documentAmount);
      const { downloadJobDocumentPdf } = await import("../pdf/job-document-pdf");
      await downloadJobDocumentPdf({
        type: documentType,
        clientName: selectedJob.clientName,
        jobTitle: selectedJob.title,
        property: selectedJob.serviceAddressLine1 ?? "",
        location: cityStateZip(selectedJob),
        scope: documentScope,
        terms: documentTerms,
        amount: amount !== null && Number.isFinite(amount) ? amount : null,
        status: jobStatus(selectedJob),
        cycleNumber: selectedJob.currentCycle.cycleNumber,
        evidenceCount: stats.total,
      });
    } finally {
      setDocumentPdfBusy(false);
    }
  }

  return (
    <AppLayout
      work="Reporting"
      client={client === "all" ? "All clients" : client}
      status="Explore"
      next={`${filtered.length} Jobs`}
    >
      <div className="page">
        <div className="shell workspace-canonical-page insights-page reporting-v3 reporting-canonical-page">
          <WorkspaceHero
            eyebrow="Media · Reporting"
            title="Reporting"
            description="Filter the Job record live, choose what facts matter, then export the result or turn selected work into a real document."
            metrics={[
              { label: "Jobs in view", value: filtered.length },
              { label: "Selected", value: selectedJobs.length },
              { label: "Fields", value: selectedFields.length },
            ]}
          />

          {state.status === "loading" ? <div className="panel">Loading reporting data…</div> : null}
          {state.status === "error" ? <div className="notice notice-error">{state.message}</div> : null}

          {state.status === "ready" ? (
            <>
              <section className="panel reporting-v3-filters reporting-canonical-surface">
                <div className="reporting-v3-filter-head">
                  <div>
                    <p className="eyebrow">Filter</p>
                    <strong>Narrow the work</strong>
                    <span>Results update immediately as you narrow the work.</span>
                  </div>
                  <button className="btn" type="button" onClick={clearFilters}>Clear filters</button>
                </div>

                <div className="report-filter-grid reporting-v3-filter-grid">
                  <label>Client<select className="select" value={client} onChange={(event) => setClient(event.target.value)}><option value="all">All clients</option>{clients.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label>Town<select className="select" value={city} onChange={(event) => setCity(event.target.value)}><option value="all">All towns</option>{cities.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label>Status<select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option></select></label>
                  <label className="reporting-v3-keyword">Work / keyword<input className="input" placeholder="water leak, deck, outlet, trim…" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></label>
                  <label>Evidence<select className="select" value={evidence} onChange={(event) => setEvidence(event.target.value)}><option value="all">Any coverage</option><option>Before + After</option><option>Missing Before</option><option>Missing After</option><option>During only</option><option>None</option></select></label>
                  <label>Cycles<select className="select" value={cycles} onChange={(event) => setCycles(event.target.value)}><option value="all">Any cycle count</option><option value="one">1 cycle</option><option value="multi">2+ cycles</option></select></label>
                  <label>From<input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
                  <label>To<input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
                  <label>Sort<select className="select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="client">Client</option><option value="town">Town</option><option value="status">Status</option></select></label>
                </div>
              </section>

              <section className="report-preview panel reporting-v3-results reporting-canonical-surface">
                <div className="reporting-v3-results-head">
                  <div>
                    <p className="eyebrow">Results</p>
                    <h2>{filtered.length} Job{filtered.length === 1 ? "" : "s"} found</h2>
                    <p>Choose Jobs only when you want to create something from them. Exports use every matching Job.</p>
                  </div>
                  <div className="reporting-v3-results-actions">
                    <button className={`btn${showFields ? " btn-primary" : ""}`} type="button" onClick={() => setShowFields((value) => !value)}>
                      {showFields ? "Close fields" : `Fields · ${selectedFields.length} shown`}
                    </button>
                    <button className="btn" type="button" disabled={visibleIds.length === 0} onClick={toggleVisibleSelection}>{allVisibleSelected ? "Clear visible" : "Select all"}</button>
                    <button className="btn" type="button" disabled={rows.length === 0 || selectedFields.length === 0} onClick={downloadCsv}>Export CSV</button>
                    <button className="btn" type="button" disabled={rows.length === 0 || selectedFields.length === 0 || pdfBusy} onClick={() => void downloadPdf()}>{pdfBusy ? "Building PDF…" : "Export PDF"}</button>
                  </div>
                </div>

                <div className="reporting-v3-report-meta">
                  <label>Report title<input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
                  <div className="reporting-v3-field-summary"><span>{selectedFields.length} of {fields.length} fields shown</span>{!showFields ? selectedFields.slice(0, 8).map((key) => { const field = fields.find((item) => item.key === key); return field ? <button key={key} type="button" onClick={() => setSelectedFields((current) => current.filter((item) => item !== key))}>{field.label} ×</button> : null; }) : null}{!showFields && selectedFields.length > 8 ? <em>+{selectedFields.length - 8} more</em> : null}</div>
                </div>

                {showFields ? (
                  <div className="report-field-library reporting-v3-field-library">
                    {fieldGroups.map((group) => (
                      <fieldset key={group}>
                        <legend>{group}</legend>
                        <div>
                          {fields.filter((field) => field.group === group).map((field) => (
                            <label key={field.key}>
                              <input
                                type="checkbox"
                                checked={selectedFields.includes(field.key)}
                                onChange={() => setSelectedFields((current) => current.includes(field.key) ? current.filter((key) => key !== field.key) : [...current, field.key])}
                              />
                              {field.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                    <div className="report-field-presets">
                      <button type="button" onClick={() => setSelectedFields(defaultFields)}>Common fields</button>
                      <button type="button" onClick={() => setSelectedFields(fields.map((field) => field.key))}>Select all {fields.length}</button>
                      <button type="button" onClick={() => setSelectedFields([])}>Clear</button>
                    </div>
                  </div>
                ) : null}

                {selectedJobs.length > 0 ? (
                  <div className="reporting-v3-selection-bar">
                    <div><strong>{selectedJobs.length} Job{selectedJobs.length === 1 ? "" : "s"} selected</strong><span>{selectedJobs.length === 1 ? "Create a document from this Job." : "Select exactly one Job for Invoice, SOW, or Proposal."}</span></div>
                    <div>
                      <div className="report-create-menu">
                        <button className="btn btn-primary" type="button" onClick={() => setCreateMenuOpen((value) => !value)}>Create ▾</button>
                        {createMenuOpen ? (
                          <div className="report-create-popover">
                            <strong>{selectedJobs.length} Job{selectedJobs.length === 1 ? "" : "s"} selected</strong>
                            <button type="button" disabled={!selectedJob} onClick={() => openDocument("invoice")}>Invoice<span>{selectedJob ? "Build from this Job" : "Select exactly 1 Job"}</span></button>
                            <button type="button" disabled={!selectedJob} onClick={() => openDocument("sow")}>Scope of Work<span>{selectedJob ? "Use the Job scope" : "Select exactly 1 Job"}</span></button>
                            <button type="button" disabled={!selectedJob} onClick={() => openDocument("proposal")}>Proposal<span>{selectedJob ? "Turn scope into a proposal" : "Select exactly 1 Job"}</span></button>
                          </div>
                        ) : null}
                      </div>
                      <button className="btn" type="button" onClick={() => { setSelectedJobIds([]); setCreateMenuOpen(false); setDocumentType(null); }}>Clear selection</button>
                    </div>
                  </div>
                ) : null}

                {documentType && selectedJob ? (
                  <div className="report-document-studio reporting-v3-document-studio">
                    <div className="report-document-head">
                      <div><p className="eyebrow">Create from selected</p><h2>{documentType === "invoice" ? "Invoice" : documentType === "proposal" ? "Proposal" : "Scope of Work"} · {selectedJob.title}</h2><p>{selectedJob.clientName} · {cityStateZip(selectedJob) || "No property location"}</p></div>
                      <button className="btn" type="button" onClick={() => setDocumentType(null)}>Close</button>
                    </div>
                    <div className="report-document-grid">
                      <label>Scope / description<textarea value={documentScope} onChange={(event) => setDocumentScope(event.target.value)} rows={5} /></label>
                      <div className="report-document-side">
                        {documentType !== "sow" ? <label>{documentType === "invoice" ? "Amount due" : "Proposed amount"}<input className="input" value={documentAmount} inputMode="decimal" placeholder="Leave blank if not yet entered" onChange={(event) => setDocumentAmount(event.target.value)} /></label> : null}
                        <label>Terms / notes<textarea value={documentTerms} onChange={(event) => setDocumentTerms(event.target.value)} rows={4} /></label>
                        <button className="btn btn-primary" type="button" disabled={documentPdfBusy || !documentScope.trim()} onClick={() => void downloadDocumentPdf()}>{documentPdfBusy ? "Building PDF…" : `Download ${documentType === "sow" ? "SOW" : titleCase(documentType)} PDF`}</button>
                      </div>
                    </div>
                    <p className="report-document-truth">Vizow pre-fills only what this Job actually contains. Missing price information stays blank until you enter it; nothing is invented.</p>
                  </div>
                ) : null}

                {selectedFields.length === 0 ? <div className="report-empty-fields">Choose at least one field to preview or export a report.</div> : (
                  <div className="report-table-wrap reporting-v3-table-wrap">
                    <table>
                      <thead><tr><th className="report-select-cell"><input aria-label="Select all visible Jobs" type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} /></th>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                      <tbody>
                        {filtered.slice(0, 75).map((job, index) => {
                          const row = rows[index];
                          const isSelected = selectedJobIds.includes(job.id);
                          return <tr key={job.id} className={isSelected ? "is-selected" : ""}><td className="report-select-cell"><input aria-label={`Select ${job.title}`} type="checkbox" checked={isSelected} onChange={() => toggleSelectedJob(job.id)} /></td>{columns.map((column) => <td key={column}>{row[column]}</td>)}</tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {rows.length > 75 ? <p className="report-preview-note">Previewing first 75 rows. Exports include all {rows.length} matching Jobs.</p> : null}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
