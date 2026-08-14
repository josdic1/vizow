import { useState } from "react";
import { getDemoIssue } from "./demoReplacementIssues";
import { useDemo } from "./useDemo";

export function DemoCompare() {
  const { activeIssueId, backToList, showGuided } = useDemo();
  const issue = getDemoIssue(activeIssueId);
  const [split, setSplit] = useState(50);

  return (
    <div className="demo-compare">
      <button type="button" className="demo-back-link" onClick={backToList}>← Back to your list</button>

      <header className="demo-compare-head">
        <p className="eyebrow">{issue.short}</p>
        <h1>{issue.label}</h1>
      </header>

      <figure className="demo-comparison">
        <div className="demo-comparison-stage">
          <img className="demo-comparison-before" src={issue.beforeImage} alt={issue.beforeAlt} />
          <div className="demo-comparison-after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
            <div className="demo-comparison-after-copy">
              <p className="eyebrow">With Vizow</p>
              <p>{issue.after}</p>
            </div>
          </div>
          <span className="demo-comparison-label is-before">BEFORE</span>
          <span className="demo-comparison-label is-after">WITH VIZOW</span>
          <div className="demo-comparison-divider" style={{ left: `${split}%` }} aria-hidden="true"><span>↔</span></div>
          <input
            className="demo-comparison-range"
            type="range"
            min="8"
            max="92"
            value={split}
            aria-label={`Compare before and with Vizow for ${issue.short}`}
            onChange={(event) => setSplit(Number(event.currentTarget.value))}
          />
        </div>
        <figcaption>
          <div><span>BEFORE</span><p>{issue.before}</p></div>
          <div><span>WITH VIZOW</span><p>{issue.after}</p></div>
        </figcaption>
      </figure>

      <div className="demo-compare-cta">
        <button type="button" className="btn btn-primary" onClick={showGuided}>Show me →</button>
      </div>
    </div>
  );
}
