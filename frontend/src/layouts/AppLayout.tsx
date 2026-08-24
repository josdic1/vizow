import type { ComponentProps, ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { AdminSampleDataMenu } from "../components/AdminSampleDataMenu";
import { ContextRail } from "../components/ContextRail";
import { MediaNavMenu } from "../components/MediaNavMenu";
import { SectionRail, type SectionRailItem } from "../components/SectionRail";

type AppLayoutProps = ComponentProps<typeof ContextRail> & {
  children: ReactNode;
  sections?: SectionRailItem[];
  sectionLabel?: string;
};

export function AppLayout({
  children,
  sections = [],
  sectionLabel = "On this page",
  ...contextRailProps
}: AppLayoutProps) {
  return (
    <main>
      <div className="app-header">
        <header className="site-header shell">
          <Link className="brand-lockup" to="/app" aria-label="VIZOW Home">
            <img className="brand-mark" src="/icons/vizow-icon.svg" alt="" />
            <span className="brand-copy">
              <strong>VIZOW</strong>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Primary navigation">
            <NavLink
              className={({ isActive }) =>
                `site-nav-link${isActive ? " site-nav-link-active" : ""}`
              }
              to="/app"
              end
            >
              Inbox
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `site-nav-link${isActive ? " site-nav-link-active" : ""}`
              }
              to="/app/today"
            >
              Today
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `site-nav-link${isActive ? " site-nav-link-active" : ""}`
              }
              to="/app/jobs"
            >
              Jobs
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `site-nav-link${isActive ? " site-nav-link-active" : ""}`
              }
              to="/app/calendar"
            >
              Calendar
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `site-nav-link${isActive ? " site-nav-link-active" : ""}`
              }
              to="/app/clients"
            >
              Clients
            </NavLink>
            <MediaNavMenu />
            <span className="site-nav-separator" aria-hidden="true" />
            <AdminSampleDataMenu />
          </nav>
        </header>
      </div>

      <ContextRail {...contextRailProps} />

      <span className="section-rail-top-anchor" id="page-top" />
      <SectionRail items={sections} label={sectionLabel} />
      {children}
    </main>
  );
}
