import { useEffect, useState } from "react";
import { useDemo } from "./useDemo";

const steps = [
  { title: "Request arrives", label: "Inbox", body: "A client or contractor records incoming work. It stays a Request until it is reviewed." },
  { title: "Create the Job", label: "Job", body: "Confirm the client, work, and service address. The intake record stays intact." },
  { title: "Run the work", label: "Field Mode", body: "Visits, notes, scope changes, and media stay attached to the active Job." },
  { title: "Keep the proof", label: "VOW", body: "Before, during, and after evidence becomes one visual record across every cycle." },
  { title: "Reuse the work", label: "Media", body: "Generate customer updates, work samples, marketing output, social posts, or invoices." },
  { title: "Stop hunting", label: "Client history", body: "Clients, properties, Jobs, media, and historical records remain connected and searchable." },
];

export function DemoWalkthrough() {
  const { setView } = useDemo();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStep((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 2400);
    return () => window.clearInterval(id);
  }, [playing]);

  const current = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <section className="demo-walkthrough panel">
      <div className="demo-walkthrough-stage">
        <div className="demo-walkthrough-top"><span>{current.label}</span><b>{step + 1} / {steps.length}</b></div>
        <div className="demo-walkthrough-screen">
          <p className="eyebrow">Guided walkthrough</p>
          <h2>{current.title}</h2>
          <p>{current.body}</p>
          <div className="demo-walkthrough-visual" aria-hidden="true">
            <span className={step >= 0 ? "is-on" : ""}>Request</span>
            <i>→</i><span className={step >= 1 ? "is-on" : ""}>Job</span>
            <i>→</i><span className={step >= 2 ? "is-on" : ""}>Field</span>
            <i>→</i><span className={step >= 3 ? "is-on" : ""}>VOW</span>
            <i>→</i><span className={step >= 4 ? "is-on" : ""}>Outputs</span>
          </div>
        </div>
        <div className="demo-walkthrough-progress"><span style={{ width: `${progress}%` }} /></div>
        <div className="demo-walkthrough-controls">
          <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>Back</button>
          <button className="is-primary" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button>
          <button type="button" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} disabled={step === steps.length - 1}>Next</button>
        </div>
      </div>
      <aside className="demo-walkthrough-aside">
        <p className="eyebrow">Jump in</p>
        <h3>Don't just watch it.</h3>
        <p>The simulators and problem labs beside this walkthrough are interactive and resettable.</p>
        <button className="btn btn-primary" type="button" onClick={() => setView("problems")}>Try the problem list</button>
      </aside>
    </section>
  );
}
