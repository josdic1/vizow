import { useState } from "react";
import { Link } from "react-router";
import { startPrivateDemo } from "../api/demoSession";
import { DemoCompare } from "../demo/DemoCompare";
import { DemoGuided } from "../demo/DemoGuided";
import { DemoList } from "../demo/DemoList";
import { demoIssues } from "../demo/demoReplacementIssues";
import { useDemo } from "../demo/useDemo";
import "../styles/demo.css";

function stageLabel(stage: "list" | "compare" | "guided"): string {
  if (stage === "list") return "Guided Walkthrough";
  if (stage === "compare") return "Before ↔ With Vizow";
  if (stage === "guided") return "Walkthrough";
  return "Walkthrough";
}

export function DemoPage({ onTour }: { onTour: () => void }) {
  const { stage, activeIssueId, completedIssueIds, reset } = useDemo();
  const activeIssue = demoIssues.find((issue) => issue.id === activeIssueId) ?? demoIssues[0];
  const stageTitle = stage === "compare" || stage === "guided" ? activeIssue.short : stageLabel(stage);
  const isList = stage === "list";
  const canReset = completedIssueIds.length > 0;
  const [startingDemo, setStartingDemo] = useState(false);

  async function openPrivateDemo() {
    if (startingDemo) return;
    setStartingDemo(true);

    try {
      await startPrivateDemo();
      window.location.assign("/app");
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to start a private Vizow demo.",
      );
      setStartingDemo(false);
    }
  }

  return (
    <main className={`demo-shell demo-shell-${stage}`}>
      <header className="demo-masthead">
        <Link
          className="brand-lockup"
          to="/demo"
          aria-label="VIZOW 60-second tour"
          onClick={(event) => {
            event.preventDefault();
            onTour();
          }}
        >
          <img className="brand-mark" src="/icons/vizow-icon.svg" alt="" />
          <span className="brand-copy"><strong>VIZOW</strong></span>
        </Link>

        <div className="demo-masthead-label">
          {isList ? (
            <>
              <span>Demo</span>
              <strong>Guided Walkthrough</strong>
              <small>Choose a workflow · drag the comparison · walk through it</small>
            </>
          ) : (
            <>
              <span>{stageLabel(stage)}</span>
              <strong>{stageTitle}</strong>
              <small>{completedIssueIds.length} / {demoIssues.length} tried</small>
            </>
          )}
        </div>

        <div className="demo-masthead-actions">
          {canReset ? <button type="button" onClick={reset}>Reset Walkthrough</button> : null}
          <button type="button" onClick={onTour}>60-Second Tour</button>
          <button
            className="demo-enter-live"
            type="button"
            disabled={startingDemo}
            onClick={() => void openPrivateDemo()}
          >
            {startingDemo ? "Building…" : "Try Live Vizow →"}
          </button>
        </div>
      </header>

      <div className="demo-page">
        {stage === "list" ? <DemoList /> : null}
        {stage === "compare" ? <DemoCompare key={activeIssueId} /> : null}
        {stage === "guided" ? <DemoGuided key={activeIssueId} /> : null}
      </div>

      <footer className="demo-contact">
        <span>Questions or feedback?</span>
        <a href="mailto:emailjoshdicker@gmail.com">emailjoshdicker@gmail.com</a>
      </footer>
    </main>
  );
}
