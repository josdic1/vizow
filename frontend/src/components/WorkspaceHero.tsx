import type { ReactNode } from "react";
import { Link } from "react-router";

type WorkspaceMetric = {
  label: string;
  value: ReactNode;
  href?: string;
};

type WorkspaceHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  metrics?: WorkspaceMetric[];
};

export function WorkspaceHero({
  eyebrow,
  title,
  description,
  metrics = [],
}: WorkspaceHeroProps) {
  return (
    <header className="workspace-hero">
      <div className="workspace-hero-intro">
        <p className="workspace-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="workspace-hero-description">{description}</p>
      </div>

      {metrics.length > 0 && (
        <div className="workspace-metrics" aria-label={`${eyebrow} totals`}>
          {metrics.map((metric) =>
            metric.href ? (
              <Link key={metric.label} to={metric.href}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </Link>
            ) : (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ),
          )}
        </div>
      )}
    </header>
  );
}
