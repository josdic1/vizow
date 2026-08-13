import "./ContextRail.css";

export type ContextRailStep = "object" | "tool" | "action" | "result";

export type ContextRailTone =
  | "neutral"
  | "working"
  | "success"
  | "error";

type ContextRailProps = {
  // Current semantic API. Use this on work-centered screens.
  work?: string;
  client?: string;
  status?: string;
  next?: string;

  // Legacy API retained so existing pages do not break while they migrate.
  object?: string;
  tool?: string;
  action?: string;
  result?: string;
  message?: string;
  activeStep?: ContextRailStep;
  resultTone?: ContextRailTone;
};

type ContextRailItemProps = {
  name: ContextRailStep;
  label: string;
  value?: string;
  activeStep?: ContextRailStep;
  tone?: ContextRailTone;
};

function ContextRailItem({
  name,
  label,
  value,
  activeStep,
  tone = "neutral",
}: ContextRailItemProps) {
  const classes = [
    "context-rail__item",
    activeStep === name ? "context-rail__item--active" : "",
    name === "result" ? `context-rail__item--${tone}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <span className="context-rail__label">{label}</span>
      <span className="context-rail__value" title={value}>
        {value || "—"}
      </span>
    </div>
  );
}

export function ContextRail({
  work,
  client,
  status,
  next,
  object,
  tool,
  action,
  result,
  message,
  activeStep,
  resultTone = "neutral",
}: ContextRailProps) {
  const semanticMode = [work, client, status, next].some(
    (value) => value !== undefined,
  );

  if (semanticMode) {
    return (
      <section
        className="context-rail context-rail--semantic"
        aria-label="Current work context"
      >
        <div className="context-rail__steps">
          <ContextRailItem name="object" label="Work" value={work} />
          <ContextRailItem name="tool" label="Client" value={client} />
          <ContextRailItem name="action" label="Status" value={status} />
          <ContextRailItem name="result" label="Next" value={next} />
        </div>
        {message ? (
          <p className="context-rail__message" aria-live="polite">
            {message}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="context-rail" aria-label="Current work context">
      <div className="context-rail__steps">
        <ContextRailItem
          name="object"
          label="Object"
          value={object}
          activeStep={activeStep}
        />
        <ContextRailItem
          name="tool"
          label="Tool"
          value={tool}
          activeStep={activeStep}
        />
        <ContextRailItem
          name="action"
          label="Action"
          value={action}
          activeStep={activeStep}
        />
        <ContextRailItem
          name="result"
          label="Result"
          value={result}
          activeStep={activeStep}
          tone={resultTone}
        />
      </div>
      <p className="context-rail__message" aria-live="polite">
        {message || "No work is currently selected."}
      </p>
    </section>
  );
}
