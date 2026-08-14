import { demoIssues } from "./demoReplacementIssues";
import { useDemo } from "./useDemo";

export function DemoList() {
  const { completedIssueIds, openIssue } = useDemo();
  const total = demoIssues.length;
  const done = completedIssueIds.length;
  const allDone = done === total;

  return (
    <div className="demo-list">
      <header className="demo-list-head">
        <p className="eyebrow">Pick the mess you recognize.</p>
        <h1>What's wasting your time?</h1>
        <p>One at a time. See the mess, then see the fix. {total} things, about a minute each.</p>
      </header>



      <div className="demo-progress-meter" aria-label={`${done} of ${total} sorted`}>
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <strong className="demo-progress-label">{done} / {total} sorted</strong>

      {allDone ? (
        <div className="demo-done-banner">
          <div>
            <p className="eyebrow">That's the list</p>
            <h2>Eight messes. Eight fixes.</h2>
            <p>The demo stays self-contained: no account, no sample-data loading, and nothing is saved.</p>
          </div>
        </div>
      ) : null}

      <ul className="demo-punch-list">
        {demoIssues.map((issue) => {
          const isDone = completedIssueIds.includes(issue.id);
          return (
            <li key={issue.id}>
              <button type="button" className={isDone ? "is-complete" : ""} onClick={() => openIssue(issue.id)}>
                <span className="demo-check" aria-hidden="true">{isDone ? "✓" : ""}</span>
                <span className="demo-punch-copy">
                  <strong>{issue.short}</strong>
                  <small>{issue.label}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
