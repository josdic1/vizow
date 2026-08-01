import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {meta ? <div className="admin-page-meta">{meta}</div> : null}
      </div>

      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}
