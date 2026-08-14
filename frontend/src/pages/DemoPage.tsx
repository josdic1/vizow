import { Link } from "react-router";
import { DemoCompare } from "../demo/DemoCompare";
import { DemoGuided } from "../demo/DemoGuided";
import { DemoList } from "../demo/DemoList";
import { demoIssues } from "../demo/demoReplacementIssues";
import { useDemo } from "../demo/useDemo";
import "../styles/demo.css";

function stageLabel(stage: "list" | "compare" | "guided"): string {
  if (stage === "list") return "What Vizow fixes";
  if (stage === "compare") return "Before ↔ With Vizow";
  if (stage === "guided") return "Show me the fix";
  return "Show me the fix";
}

export function DemoPage() {
  const { stage, activeIssueId, completedIssueIds, reset } = useDemo();
  const activeIssue = demoIssues.find((issue) => issue.id === activeIssueId) ?? demoIssues[0];
  const stageTitle = stage === "compare" || stage === "guided" ? activeIssue.short : stageLabel(stage);

  return (
    <main className="demo-shell">
      <header className="demo-masthead">
        <Link className="brand-lockup" to="/" aria-label="VIZOW Home">
          <img className="brand-mark" src="/icons/vizow-icon.svg" alt="" />
          <span className="brand-copy"><strong>VIZOW</strong></span>
        </Link>
        <div className="demo-masthead-label">
          <span>Public demo</span>
          <strong>{stageTitle}</strong>
          <small>{completedIssueIds.length} / {demoIssues.length} fixes tried</small>
        </div>
        <div className="demo-masthead-actions">
          <button type="button" onClick={reset}>Reset Demo</button>
          <Link to="/">Exit Vizow →</Link>
        </div>
      </header>

      <div className="demo-page">
        {stage === "list" ? <DemoList /> : null}
        {stage === "compare" ? <DemoCompare key={activeIssueId} /> : null}
        {stage === "guided" ? <DemoGuided key={activeIssueId} /> : null}
      </div>
    </main>
  );
}
