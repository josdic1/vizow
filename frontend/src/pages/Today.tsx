import type { Job, Request, Visit } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { fetchVisits } from "../api/jobs";
import { fetchRequests } from "../api/requests";
import { useActiveJob } from "../contexts/ActiveJobContext";
import { SectionRail } from "../components/SectionRail";
import { AdminSampleDataMenu } from "../components/AdminSampleDataMenu";

type ScheduledVisit = { job: Job; visit: Visit };
type DashboardState =
  | { status: "loading" }
  | { status: "ready"; requests: Request[]; visits: ScheduledVisit[] }
  | { status: "error"; message: string };

function formatAddress(job: Job): string {
  return [
    [job.serviceAddressLine1, job.serviceAddressLine2].filter(Boolean).join(", "),
    [job.serviceCity, job.serviceState, job.servicePostalCode]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean).join(", ") || "No service address recorded";
}

function formatToday(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric",
  }).format(new Date());
}

function isSameDay(value: string, comparison: Date): boolean {
  const date = new Date(value);
  return date.getFullYear() === comparison.getFullYear() &&
    date.getMonth() === comparison.getMonth() &&
    date.getDate() === comparison.getDate();
}

function formatVisitTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" });
  return `${month.format(start).toUpperCase()} ${start.getDate()} — ${
    start.getMonth() === end.getMonth()
      ? end.getDate()
      : `${month.format(end).toUpperCase()} ${end.getDate()}`
  }`;
}

function formatVisitHeading(date: Date, today: Date): string {
  if (dateKey(date) === dateKey(today)) return "Today’s Visits";
  return `${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date)}’s Visits`;
}

export function Today() {
  const {
    jobs, activeJob, activeJobId, status: jobsStatus, error: jobsError,
    selectActiveJob, reloadJobs,
  } = useActiveJob();
  const [dashboard, setDashboard] = useState<DashboardState>({ status: "loading" });
  const today = useMemo(() => new Date(), []);
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKey(new Date()));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    if (jobsStatus !== "ready") return;
    const controller = new AbortController();

    Promise.all([
      fetchRequests(controller.signal),
      Promise.all(jobs.map(async (job) => {
        const visits = await fetchVisits(job.id, controller.signal);
        return visits.map((visit) => ({ job, visit }));
      })),
    ])
      .then(([requests, visitsByJob]) => setDashboard({
        status: "ready",
        requests,
        visits: visitsByJob.flat()
          .filter(({ visit }) => visit.status !== "cancelled")
          .sort((left, right) =>
            left.visit.scheduledStart.localeCompare(right.visit.scheduledStart),
          ),
      }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDashboard({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to load Today.",
        });
      });

    return () => controller.abort();
  }, [jobs, jobsStatus]);

  const todayVisits = useMemo(
    () => dashboard.status === "ready"
      ? dashboard.visits.filter(({ visit }) => isSameDay(visit.scheduledStart, today))
      : [],
    [dashboard, today],
  );
  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateKey]);
  const selectedVisits = useMemo(
    () => dashboard.status === "ready"
      ? dashboard.visits.filter(({ visit }) => isSameDay(visit.scheduledStart, selectedDate))
      : [],
    [dashboard, selectedDate],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const suggestedVisit = selectedDateKey === dateKey(today)
    ? selectedVisits.find(({ visit }) => visit.status !== "completed")
    : undefined;
  const pendingRequests = dashboard.status === "ready"
    ? dashboard.requests.filter((request) => request.status === "open").length
    : 0;
  const upcomingJobs = dashboard.status === "ready"
    ? new Set(dashboard.visits.filter(({ visit }) =>
        visit.status === "scheduled" &&
        new Date(visit.scheduledStart).getTime() >= today.getTime(),
      ).map(({ job }) => job.id)).size
    : 0;
  const loading = jobsStatus === "loading" || dashboard.status === "loading";
  const error = jobsStatus === "error"
    ? jobsError ?? "Unable to load Jobs."
    : dashboard.status === "error" ? dashboard.message : null;

  function changeWeek(days: number): void {
    const next = addDays(weekStart, days);
    setWeekStart(next);
    setSelectedDateKey(dateKey(next));
  }

  return (
    <main className="today-page">
      <span className="section-rail-top-anchor" id="page-top" />
      <SectionRail
        label="Today"
        items={[
          { id: "today-overview", label: "Overview" },
          { id: "today-schedule", label: "Schedule" },
          { id: "today-current", label: "Current Job" },
        ]}
      />
      <div className="today-shell">
        <header className="today-header">
          <Link className="today-mark" to="/">VIZOW</Link>
          <div className="today-date"><span>Today</span><strong>{formatToday()}</strong></div>
          <nav className="today-nav" aria-label="Primary">
            <Link to="/inbox">Inbox</Link>
            <Link to="/jobs">Jobs</Link>
            <AdminSampleDataMenu />
          </nav>
        </header>

        <section className="today-dashboard" id="today-overview" aria-labelledby="today-title">
          <div className="today-dashboard-intro">
            <p className="today-eyebrow">Workday</p>
            <h1 id="today-title">Today at a glance</h1>
            <p>Review what needs attention, then confirm where you are working.</p>
          </div>
          <div className="today-metrics">
            <Link to="/inbox"><span>New in Inbox</span><strong>{loading ? "—" : pendingRequests}</strong></Link>
            <a href="#today-schedule"><span>Visits today</span><strong>{loading ? "—" : todayVisits.length}</strong></a>
            <Link to="/jobs"><span>Jobs coming up</span><strong>{loading ? "—" : upcomingJobs}</strong></Link>
          </div>
        </section>

        {error && (
          <div className="today-state today-state-error" role="alert">
            <strong>Today could not be loaded.</strong><span>{error}</span>
            <button type="button" onClick={reloadJobs}>Try Again</button>
          </div>
        )}

        <section className="today-schedule" id="today-schedule">
          <div className="today-week-strip" aria-label="Visit schedule by day">
            <div className="today-week-toolbar">
              <div>
                <p className="today-eyebrow">Schedule</p>
                <strong>{formatWeekRange(weekStart)}</strong>
              </div>
              <div className="today-week-controls">
                <button
                  aria-label="Previous week"
                  type="button"
                  onClick={() => changeWeek(-7)}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeekStart(startOfWeek(today));
                    setSelectedDateKey(dateKey(today));
                  }}
                >
                  This week
                </button>
                <button
                  aria-label="Next week"
                  type="button"
                  onClick={() => changeWeek(7)}
                >
                  →
                </button>
              </div>
            </div>

            <div className="today-week-days">
              {weekDays.map((day) => {
                const key = dateKey(day);
                const count = dashboard.status === "ready"
                  ? dashboard.visits.filter(({ visit }) => isSameDay(visit.scheduledStart, day)).length
                  : 0;
                const isToday = key === dateKey(today);
                const isSelected = key === selectedDateKey;

                return (
                  <button
                    className={`${isSelected ? "is-selected " : ""}${isToday ? "is-today" : ""}`.trim()}
                    key={key}
                    type="button"
                    onClick={() => setSelectedDateKey(key)}
                  >
                    <span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day).toUpperCase()}</span>
                    <strong>{day.getDate()}</strong>
                    <small>{loading ? "—" : count === 1 ? "1 visit" : `${count} visits`}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <header className="today-section-heading">
            <div>
              <p className="today-eyebrow">Daily schedule</p>
              <h2>{formatVisitHeading(selectedDate, today)}</h2>
            </div>
            <span>{selectedVisits.length} scheduled</span>
          </header>

          {!loading && !error && selectedVisits.length === 0 && (
            <div className="today-empty">No Visits are scheduled for this day.</div>
          )}

          <div className="today-visit-list">
            {selectedVisits.map(({ job, visit }, index) => {
              const isCurrent = activeJobId === job.id;
              const isSuggested = suggestedVisit?.visit.id === visit.id;
              const className = isSuggested && !isCurrent
                ? "today-visit-row today-visit-row-suggested"
                : isCurrent ? "today-visit-row today-visit-row-current" : "today-visit-row";

              return (
                <article className={className} key={visit.id}>
                  <time dateTime={visit.scheduledStart}>{formatVisitTime(visit.scheduledStart)}</time>
                  <div className="today-visit-copy">
                    <span>{index === 0 ? "First stop" : `Stop ${index + 1}`}</span>
                    <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                    <p>{job.clientName} · {formatAddress(job)}</p>
                  </div>
                  <div className="today-visit-status">
                    <span>{visit.status}</span>
                    {isCurrent ? (
                      <Link className="today-button today-button-primary" to="/field">Current Job</Link>
                    ) : (
                      <button type="button" onClick={() => selectActiveJob(job.id)}>
                        {isSuggested ? "Work here?" : "Make Current"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {activeJob && (
          <section className="today-current-confirmation" id="today-current">
            <div>
              <p className="today-eyebrow">Confirmed Current Job</p>
              <h2>{activeJob.title}</h2>
              <p>{activeJob.clientName} · {formatAddress(activeJob)}</p>
            </div>
            <div className="today-route-actions">
              <Link className="today-button today-button-secondary" to={`/jobs/${activeJob.id}`}>Job Page</Link>
              <Link className="today-button today-button-primary" to="/field">Enter Field Mode</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
