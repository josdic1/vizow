import type { ComponentProps, ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ContextRail } from "../components/ContextRail";

type AppLayoutProps = ComponentProps<typeof ContextRail> & {
  children: ReactNode;
};

export function AppLayout({
  children,
  ...contextRailProps
}: AppLayoutProps) {
  return (
    <main>
      <div className="app-header">
        <header className="site-header shell">
          <Link
            className="brand-lockup"
            to="/requests"
            aria-label="VIZOW Requests"
          >
            <img
              className="brand-mark"
              src="/icons/vizow-icon.svg"
              alt=""
            />

            <span className="brand-copy">
              <strong>VIZOW</strong>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Primary navigation">
            <NavLink
              className={({ isActive }) =>
                `site-nav-link${isActive ? " site-nav-link-active" : ""}`
              }
              to="/requests"
            >
              Requests
            </NavLink>

            <NavLink
              className={({ isActive }) =>
                `site-nav-link${isActive ? " site-nav-link-active" : ""}`
              }
              to="/jobs"
            >
              Jobs
            </NavLink>
          </nav>

          <div className="header-actions">
            <span className="badge">Visual of Work</span>
          </div>
        </header>
      </div>

      <ContextRail {...contextRailProps} />

      {children}
    </main>
  );
}
