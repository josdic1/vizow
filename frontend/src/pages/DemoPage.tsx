import { Link } from "react-router";
import { DemoProblemLab } from "../demo/DemoProblemLab";
import { DemoWalkthrough } from "../demo/DemoWalkthrough";
import { demoIssues } from "../demo/demoIssues";
import { useDemo } from "../demo/useDemo";
import "../styles/demo.css";

const navItems = [
  { view: "problems" as const, label: "What Vizow Fixes", shortLabel: "Fixes" },
  { view: "contractor" as const, label: "Contractor Simulator", shortLabel: "Contractor" },
  { view: "client" as const, label: "Client Simulator", shortLabel: "Client" },
  { view: "documentation" as const, label: "Documentation", shortLabel: "Docs" },
  { view: "walkthrough" as const, label: "Guided Walkthrough", shortLabel: "Walkthrough" },
];

const nextByView = {
  problems: "Pick one problem",
  contractor: "Run the Job",
  client: "Submit a request",
  documentation: "Read the system",
  walkthrough: "Follow the steps",
} as const;

function DemoFrame({ src, title, eyebrow, heading, copy }: { src: string; title: string; eyebrow: string; heading: string; copy: string }) {
  return (
    <section className="demo-simulator-wrap">
      <header className="demo-simulator-head"><div><p className="eyebrow">{eyebrow}</p><h1>{heading}</h1><p>{copy}</p></div><span>DEMO ONLY · RESETS ON REFRESH</span></header>
      <div className="demo-simulator-frame"><iframe src={src} title={title} /></div>
    </section>
  );
}

function Documentation() {
  return (
    <section className="demo-docs">
      <header><p className="eyebrow">Documentation</p><h1>Vizow in plain English.</h1><p>No product-tour jargon. These are the core records and why each exists.</p></header>
      <div className="demo-doc-grid">
        <article><span>01</span><h2>Request</h2><p>Incoming work. It preserves what was asked before anything becomes a Job.</p></article>
        <article><span>02</span><h2>Job</h2><p>The canonical work record. Client, property, lifecycle, cycles, visits, scope, notes, and media connect here.</p></article>
        <article><span>03</span><h2>Cycle</h2><p>A chapter of the Job. Completed work can reopen without erasing the previous chapter.</p></article>
        <article><span>04</span><h2>Field Mode</h2><p>Jobsite interface: large actions, notes, photos, visit controls, and trade tools.</p></article>
        <article><span>05</span><h2>Media Library</h2><p>Searchable Job evidence. Select real media and generate outputs without changing the source record.</p></article>
        <article><span>06</span><h2>Visual of Work</h2><p>One living visual record of the entire Job across every cycle.</p></article>
        <article><span>07</span><h2>Calendar</h2><p>Contractor schedule is private truth; the public view exposes only safe availability.</p></article>
        <article><span>08</span><h2>Reporting + Data</h2><p>Filter the work, understand the business, and export useful reports from the same records.</p></article>
      </div>
    </section>
  );
}

export function DemoPage() {
  const { view, setView, activeIssue, openIssue, completedIssues, completeIssue, reset } = useDemo();
  const completedCount = demoIssues.filter((issue) => completedIssues.includes(issue.id)).length;
  const currentView = navItems.find((item) => item.view === view)?.label ?? "Public Demo";

  return (
    <main className="demo-shell">
      <header className="demo-masthead">
        <div className="shell demo-masthead-top">
          <Link className="brand-lockup" to="/" aria-label="VIZOW Home">
            <img className="brand-mark" src="/icons/vizow-icon.svg" alt="" />
            <span className="brand-copy"><strong>VIZOW</strong></span>
          </Link>
          <div className="demo-masthead-title">
            <span>Public demo</span>
            <strong>{currentView}</strong>
          </div>
          <div className="demo-masthead-actions">
            <button type="button" onClick={reset}>Reset Demo</button>
            <Link to="/">Exit Vizow →</Link>
          </div>
        </div>
        <nav className="shell demo-nav-tabs" aria-label="Demo navigation">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? "is-active" : ""}
              type="button"
              onClick={() => setView(item.view)}
              aria-current={view === item.view ? "page" : undefined}
            >
              <span className="demo-nav-long">{item.label}</span>
              <span className="demo-nav-short">{item.shortLabel}</span>
            </button>
          ))}
        </nav>
      </header>

      <section className="demo-context-strip" aria-label="Demo context">
        <div><span>View</span><strong>{currentView}</strong></div>
        <div><span>Progress</span><strong>{completedCount} of {demoIssues.length} fixes tried</strong></div>
        <div><span>Data</span><strong>Demo only · nothing saved</strong></div>
        <div><span>Next</span><strong>{nextByView[view]}</strong></div>
      </section>

      {view === "contractor" ? <DemoFrame src="/demo/simulators/contractor.html" title="Vizow Contractor Simulator" eyebrow="Try it · Contractor simulator" heading="Run one Job from request to proof." copy="Review the request, schedule it, document the work, close it, and see the resulting VOW." /> : null}
      {view === "client" ? <DemoFrame src="/demo/simulators/client.html" title="Vizow Client Simulator" eyebrow="Try it · Client simulator" heading="Submit work without phone tag." copy="Pick a repair, confirm the property, add evidence, choose a preferred date, and send the request." /> : null}
      {view === "documentation" ? <div className="page"><div className="shell"><Documentation /></div></div> : null}
      {view === "walkthrough" ? <div className="page"><div className="shell"><DemoWalkthrough /></div></div> : null}

      {view === "problems" ? (
        <div className="page"><div className="shell demo-problems-layout">
          <aside className="demo-problem-list panel">
            <div className="demo-problem-list-head"><p className="eyebrow">What's wasting your time?</p><h1>Pick the mess you recognize.</h1><p>One problem at a time: see the mess, then use the Vizow fix.</p></div>
            <div className="demo-progress-meter" aria-label={`${completedCount} of ${demoIssues.length} demo problems completed`}><span style={{ width: `${(completedCount / demoIssues.length) * 100}%` }} /></div>
            <strong className="demo-progress-label">{completedCount} / {demoIssues.length} fixes tried</strong>
            <div className="demo-problem-buttons">
              {demoIssues.map((issue) => (
                <button key={issue.id} className={`${activeIssue === issue.id ? "is-active" : ""}${completedIssues.includes(issue.id) ? " is-complete" : ""}`} type="button" onClick={() => openIssue(issue.id)}>
                  <span className="demo-check">{completedIssues.includes(issue.id) ? "✓" : "□"}</span><span><strong>{issue.short}</strong><small>{issue.label}</small></span>
                </button>
              ))}
            </div>
          </aside>
          <DemoProblemLab issueId={activeIssue} completed={completedIssues.includes(activeIssue)} onComplete={() => completeIssue(activeIssue)} />
        </div></div>
      ) : null}
    </main>
  );
}
