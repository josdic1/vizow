import { useEffect } from "react";
import type { DemoIssueId } from "./DemoContext";
import { getDemoIssue } from "./demoReplacementIssues";
import { useDemo } from "./useDemo";

type DemoOutcome = {
  number: string;
  title: string;
  summary: string;
  issueIds: [DemoIssueId, DemoIssueId];
};

const demoOutcomes: DemoOutcome[] = [
  {
    number: "01",
    title: "Save time",
    summary: "Stop re-entering, searching, and scheduling by hand.",
    issueIds: ["correspondence", "field"],
  },
  {
    number: "02",
    title: "Protect your money",
    summary: "Keep the job record, approved changes, and billing attached to the work.",
    issueIds: ["record", "invoices"],
  },
  {
    number: "03",
    title: "Win more work",
    summary: "Turn the work you already did into proof people can actually see.",
    issueIds: ["marketing", "photos"],
  },
  {
    number: "04",
    title: "Know your business",
    summary: "Keep client history and job information connected instead of scattered.",
    issueIds: ["history", "notes"],
  },
];

export function DemoList() {
  const { completedIssueIds, openIssue } = useDemo();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);
  const total = demoOutcomes.reduce((count, outcome) => count + outcome.issueIds.length, 0);
  const done = completedIssueIds.length;

  return (
    <div className="demo-list">
      <header className="demo-list-head">
        <div>
          <p className="eyebrow">Guided Walkthrough</p>
          <h1>What do you want to see Vizow handle?</h1>
        </div>
        <div className="demo-list-intro">
          <p>
            Pick a workflow. First drag BEFORE ↔ WITH VIZOW, then walk through exactly
            how Vizow handles it.
          </p>
          <strong>{done} / {total} workflows tried</strong>
        </div>
      </header>

      <div className="demo-outcome-grid">
        {demoOutcomes.map((outcome) => {
          const outcomeDone = outcome.issueIds.every((issueId) => completedIssueIds.includes(issueId));

          return (
            <section key={outcome.title} className={`demo-outcome-card${outcomeDone ? " is-complete" : ""}`}>
              <div className="demo-outcome-card-head">
                <span className="demo-outcome-number">{outcome.number}</span>
                {outcomeDone ? <span className="demo-outcome-complete">Complete</span> : null}
              </div>

              <div className="demo-outcome-copy">
                <h2>{outcome.title}</h2>
                <p>{outcome.summary}</p>
              </div>

              <div className="demo-outcome-actions">
                {outcome.issueIds.map((issueId) => {
                  const issue = getDemoIssue(issueId);
                  const isDone = completedIssueIds.includes(issueId);

                  return (
                    <button
                      key={issueId}
                      type="button"
                      className={isDone ? "is-complete" : ""}
                      onClick={() => openIssue(issueId)}
                    >
                      <span>{issue.short}</span>
                      <span className="demo-outcome-arrow" aria-hidden="true">{isDone ? "✓" : "→"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
