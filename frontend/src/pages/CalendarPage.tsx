import type {
  Job,
  PublicCalendarDay,
  PublicCalendarOverrideStatus,
  PublicCalendarSettings,
  PublicCalendarStatus,
  Visit,
} from "@vizow/shared";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import {
  clearPublicCalendarDayOverride,
  fetchPublicCalendar,
  setPublicCalendarDayOverride,
  updatePublicCalendarSettings,
} from "../api/calendar";
import { fetchJobs, fetchVisits } from "../api/jobs";
import { WorkspaceHero } from "../components/WorkspaceHero";
import { AppLayout } from "../layouts/AppLayout";
import {
  calendarRange,
  calendarTitle,
  localDateKey,
  moveCalendarAnchor,
  visibleCalendarDays,
  type CalendarViewMode,
} from "../lib/calendar";

type CalendarVisit = {
  job: Job;
  visit: Visit;
};

type ScheduleState =
  | { status: "loading" }
  | { status: "ready"; visits: CalendarVisit[] }
  | { status: "error"; message: string };

type PublicState =
  | { status: "loading"; settings: PublicCalendarSettings | null; days: PublicCalendarDay[] }
  | { status: "ready"; settings: PublicCalendarSettings; days: PublicCalendarDay[] }
  | { status: "error"; settings: PublicCalendarSettings | null; days: PublicCalendarDay[]; message: string };

type PublicBulkStatus = "automatic" | PublicCalendarOverrideStatus;

const fallbackSettings: PublicCalendarSettings = {
  enabled: true,
};

const statusCopy: Record<PublicCalendarStatus, string> = {
  available: "Available",
  limited: "Limited",
  emergencies_only: "Emergency only",
  unavailable: "Unavailable",
};

const publicStatusCycle: PublicCalendarOverrideStatus[] = [
  "available",
  "limited",
  "emergencies_only",
  "unavailable",
];

function visitTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function visitTimeRange(visit: Visit): string {
  const start = visitTime(visit.scheduledStart);
  return visit.scheduledEnd ? `${start}–${visitTime(visit.scheduledEnd)}` : start;
}

function visitsByDay(visits: CalendarVisit[]): Map<string, CalendarVisit[]> {
  const grouped = new Map<string, CalendarVisit[]>();

  for (const entry of visits) {
    const key = localDateKey(new Date(entry.visit.scheduledStart));
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }

  for (const [key, entries] of grouped) {
    grouped.set(
      key,
      [...entries].sort((left, right) =>
        left.visit.scheduledStart.localeCompare(right.visit.scheduledStart),
      ),
    );
  }

  return grouped;
}

function publicDaysByDate(days: PublicCalendarDay[]): Map<string, PublicCalendarDay> {
  return new Map(days.map((day) => [day.date, day]));
}

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [schedule, setSchedule] = useState<ScheduleState>({ status: "loading" });
  const [publicState, setPublicState] = useState<PublicState>({
    status: "loading",
    settings: null,
    days: [],
  });
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<PublicBulkStatus>("automatic");
  const [savingPublic, setSavingPublic] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const visibleDays = useMemo(
    () => visibleCalendarDays(anchorDate, viewMode),
    [anchorDate, viewMode],
  );
  const range = useMemo(
    () => calendarRange(anchorDate, viewMode),
    [anchorDate, viewMode],
  );
  const groupedVisits = useMemo(
    () => visitsByDay(schedule.status === "ready" ? schedule.visits : []),
    [schedule],
  );
  const publicByDate = useMemo(
    () => publicDaysByDate(publicState.days),
    [publicState.days],
  );
  const publicSettings = publicState.settings ?? fallbackSettings;
  const todayKey = localDateKey(new Date());
  const visibleOverrideDates = publicState.days
    .filter((day) => day.isOverride && day.date >= todayKey)
    .map((day) => day.date);

  useEffect(() => {
    const controller = new AbortController();
    setSchedule({ status: "loading" });

    fetchJobs(controller.signal)
      .then(async (jobs) => {
        const visitsByJob = await Promise.all(
          jobs
            .filter((job) => job.cancelledAt === null && job.archivedAt === null)
            .map(async (job) => {
              const visits = await fetchVisits(job.id, controller.signal);
              return visits
                .filter((visit) => visit.status !== "cancelled")
                .map((visit) => ({ job, visit }));
            }),
        );

        setSchedule({
          status: "ready",
          visits: visitsByJob
            .flat()
            .sort((left, right) =>
              left.visit.scheduledStart.localeCompare(right.visit.scheduledStart),
            ),
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSchedule({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to load the schedule.",
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setPublicState((current) => ({
      status: "loading",
      settings: current.settings,
      days: current.days,
    }));
    setSelectedDates([]);

    fetchPublicCalendar(range.from, range.to, controller.signal)
      .then(({ settings, days }) => {
        setPublicState({ status: "ready", settings, days });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPublicState((current) => ({
          status: "error",
          settings: current.settings,
          days: current.days,
          message: error instanceof Error ? error.message : "Unable to load public availability.",
        }));
      });

    return () => controller.abort();
  }, [range.from, range.to]);

  function move(direction: -1 | 1): void {
    setAnchorDate((current) => moveCalendarAnchor(current, viewMode, direction));
    setFeedback(null);
    setSelectedDates([]);
  }

  function showToday(): void {
    setAnchorDate(new Date());
    setFeedback(null);
    setSelectedDates([]);
  }

  function toggleSelectedDate(date: string): void {
    if (date < todayKey || savingPublic) return;

    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((item) => item !== date)
        : [...current, date].sort(),
    );
    setFeedback(null);
  }

  function toggleMultiSelect(): void {
    setMultiSelect((current) => {
      if (current) setSelectedDates([]);
      return !current;
    });
    setFeedback(null);
  }

  async function cyclePublicDate(
    date: string,
    currentStatus: PublicCalendarStatus,
    isOverride: boolean,
  ): Promise<void> {
    if (date < todayKey || savingPublic) return;

    setSavingPublic(true);
    setFeedback(null);

    try {
      if (isOverride && currentStatus === "unavailable") {
        await clearPublicCalendarDayOverride(date);
        await refreshPublic();
        setFeedback(`${date} returned to Automatic.`);
        return;
      }

      const currentIndex = publicStatusCycle.indexOf(currentStatus);
      const nextStatus =
        currentIndex < 0 || currentIndex === publicStatusCycle.length - 1
          ? "available"
          : publicStatusCycle[currentIndex + 1];

      await setPublicCalendarDayOverride(date, nextStatus);
      await refreshPublic();
      setFeedback(`${date} set to ${statusCopy[nextStatus]}.`);
    } catch (error) {
      setPublicState((current) => ({
        status: "error",
        settings: current.settings,
        days: current.days,
        message: error instanceof Error ? error.message : "Unable to update public date.",
      }));
    } finally {
      setSavingPublic(false);
    }
  }

  async function refreshPublic(): Promise<void> {
    const refreshed = await fetchPublicCalendar(range.from, range.to);
    setPublicState({
      status: "ready",
      settings: refreshed.settings,
      days: refreshed.days,
    });
  }

  async function setEnabled(enabled: boolean): Promise<void> {
    if (savingPublic) return;
    setSavingPublic(true);
    setFeedback(null);

    try {
      await updatePublicCalendarSettings({ enabled });
      await refreshPublic();
      setSelectedDates([]);
      setFeedback(enabled ? "Public calendar is on." : "Public calendar is off.");
    } catch (error) {
      setPublicState((current) => ({
        status: "error",
        settings: current.settings,
        days: current.days,
        message: error instanceof Error ? error.message : "Unable to update public visibility.",
      }));
    } finally {
      setSavingPublic(false);
    }
  }

  async function applySelectedStatus(): Promise<void> {
    if (selectedDates.length === 0 || savingPublic) return;
    setSavingPublic(true);
    setFeedback(null);

    try {
      if (bulkStatus === "automatic") {
        await Promise.all(selectedDates.map((date) => clearPublicCalendarDayOverride(date)));
      } else {
        await Promise.all(
          selectedDates.map((date) => setPublicCalendarDayOverride(date, bulkStatus)),
        );
      }

      const count = selectedDates.length;
      await refreshPublic();
      setSelectedDates([]);
      setFeedback(
        bulkStatus === "automatic"
          ? `${count} ${count === 1 ? "date" : "dates"} returned to schedule.`
          : `${count} ${count === 1 ? "date" : "dates"} set to ${statusCopy[bulkStatus]}.`,
      );
    } catch (error) {
      setPublicState((current) => ({
        status: "error",
        settings: current.settings,
        days: current.days,
        message: error instanceof Error ? error.message : "Unable to update public dates.",
      }));
    } finally {
      setSavingPublic(false);
    }
  }

  async function normalizeVisibleSchedule(): Promise<void> {
    if (savingPublic) return;

    if (visibleOverrideDates.length === 0) {
      setFeedback("This view already matches the real schedule.");
      return;
    }

    setSavingPublic(true);
    setFeedback(null);

    try {
      await Promise.all(
        visibleOverrideDates.map((date) => clearPublicCalendarDayOverride(date)),
      );
      await refreshPublic();
      setSelectedDates([]);
      setFeedback(
        `${visibleOverrideDates.length} ${visibleOverrideDates.length === 1 ? "date" : "dates"} reset to the real schedule.`,
      );
    } catch (error) {
      setPublicState((current) => ({
        status: "error",
        settings: current.settings,
        days: current.days,
        message: error instanceof Error ? error.message : "Unable to reset public dates.",
      }));
    } finally {
      setSavingPublic(false);
    }
  }

  const privateVisitCount = visibleDays.reduce(
    (total, day) => total + (groupedVisits.get(day.key)?.length ?? 0),
    0,
  );

  return (
    <AppLayout
      object="Schedule"
      tool="Calendar"
      action="Review availability"
      result={schedule.status === "loading" ? "Loading" : `${privateVisitCount} visits`}
      message="Your Job Visits are the schedule of record. Public availability is a privacy-safe reflection of it."
      activeStep="action"
      resultTone={schedule.status === "error" ? "error" : "success"}
      sections={[
        { id: "calendar-private", label: "Booked work" },
        { id: "calendar-public", label: "Public availability" },
      ]}
    >
      <main className="page calendar-page workspace-canonical-page">
        <WorkspaceHero
          eyebrow="Schedule"
          title="Calendar"
          description="Your Job Visits are the schedule of record. Public availability follows that schedule unless you intentionally override a date."
          metrics={[
            {
              label: "Visits in view",
              value: schedule.status === "loading" ? "—" : privateVisitCount,
            },
            {
              label: "Public",
              value: publicState.status === "loading" ? "—" : publicSettings.enabled ? "On" : "Off",
            },
            {
              label: "Overrides",
              value: publicState.status === "loading" ? "—" : visibleOverrideDates.length,
            },
          ]}
        />

        <section className="calendar-canonical-section" id="calendar-private">
          <header className="calendar-canonical-heading">
            <div>
              <p className="workspace-eyebrow">Your calendar</p>
              <h2>Booked work</h2>
              <p>Real Job Visits. Public settings never change this schedule.</p>
            </div>
            <div className="calendar-period-summary">
              <span>{viewMode === "week" ? "Week view" : "Month view"}</span>
              <strong>{calendarTitle(anchorDate, viewMode)}</strong>
            </div>
          </header>

          <div className="calendar-canonical-tools" aria-label="Calendar controls">
            <div className="calendar-view-toggle" aria-label="Calendar view">
              <button
                className={viewMode === "week" ? "is-active" : undefined}
                type="button"
                onClick={() => setViewMode("week")}
              >
                Week
              </button>
              <button
                className={viewMode === "month" ? "is-active" : undefined}
                type="button"
                onClick={() => setViewMode("month")}
              >
                Month
              </button>
            </div>

            <div className="calendar-period-nav">
              <button aria-label="Previous period" type="button" onClick={() => move(-1)}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" onClick={showToday}>Today</button>
              <button aria-label="Next period" type="button" onClick={() => move(1)}>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>

            <span className="calendar-tools-note">Source of truth · {privateVisitCount} {privateVisitCount === 1 ? "visit" : "visits"} in this view</span>
          </div>

          {schedule.status === "error" ? (
            <div className="notice notice-error">{schedule.message}</div>
          ) : null}

          <div className={`calendar-grid calendar-grid-${viewMode}`}>
            {visibleDays.map((day) => {
              const dayVisits = groupedVisits.get(day.key) ?? [];

              return (
                <article
                  className={[
                    "calendar-day",
                    day.isToday ? "is-today" : "",
                    !day.isCurrentMonth && viewMode === "month" ? "is-outside" : "",
                  ].filter(Boolean).join(" ")}
                  key={day.key}
                >
                  <header>
                    <span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day.date)}</span>
                    <strong>{day.date.getDate()}</strong>
                  </header>

                  <div className="calendar-day-events">
                    {dayVisits.map(({ job, visit }) => (
                      <Link className="calendar-visit" key={visit.id} to={`/app/jobs/${job.id}`}>
                        <time>{visitTimeRange(visit)}</time>
                        <strong>{job.title}</strong>
                        <span>{job.clientName}</span>
                        <small>
                          Cycle {visit.cycleNumber}
                          {visit.status === "completed" ? " · completed" : ""}
                        </small>
                      </Link>
                    ))}
                    {dayVisits.length === 0 ? (
                      <span className="calendar-empty-day">No visits</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="calendar-canonical-section calendar-canonical-public" id="calendar-public">
          <header className="calendar-canonical-heading">
            <div>
              <p className="workspace-eyebrow">Public availability</p>
              <h2>What customers see</h2>
              <p>Same schedule underneath. Change only the dates customers should see differently.</p>
            </div>
            <div className="calendar-period-summary">
              <span>Customer view</span>
              <strong>{publicSettings.enabled ? "Public on" : "Public off"}</strong>
            </div>
          </header>

          <div className="calendar-public-toolbar">
            <div className="calendar-view-toggle" aria-label="Public calendar visibility">
              <button
                className={publicSettings.enabled ? "is-active" : undefined}
                disabled={savingPublic}
                type="button"
                onClick={() => void setEnabled(true)}
              >
                Public on
              </button>
              <button
                className={!publicSettings.enabled ? "is-active" : undefined}
                disabled={savingPublic}
                type="button"
                onClick={() => void setEnabled(false)}
              >
                Public off
              </button>
            </div>

            <div className="calendar-public-toolbar-actions">
              <button
                className="btn"
                disabled={savingPublic || !publicSettings.enabled}
                title="Reset this visible week or month to the automatic status from your real schedule."
                type="button"
                onClick={() => void normalizeVisibleSchedule()}
              >
                <RotateCcw aria-hidden="true" /> Match schedule
              </button>
              <Link className="btn" to="/availability" target="_blank" rel="noreferrer">
                <Eye aria-hidden="true" /> Preview
              </Link>
              <button
                className={`btn calendar-multi-toggle${multiSelect ? " is-active" : ""}`}
                disabled={savingPublic || !publicSettings.enabled}
                type="button"
                onClick={toggleMultiSelect}
              >
                {multiSelect ? "Done selecting" : "Select multiple"}
              </button>
            </div>
          </div>

          {feedback ? <div className="calendar-feedback" role="status">{feedback}</div> : null}
          {publicState.status === "error" ? (
            <div className="notice notice-error">{publicState.message}</div>
          ) : null}

          {!publicSettings.enabled ? (
            <div className="calendar-public-hidden-state">
              <strong>Public calendar is off.</strong>
              <span>Your real calendar is unchanged. Customers can still send a request.</span>
            </div>
          ) : (
            <>
              <div className={`calendar-grid calendar-public-grid calendar-grid-${viewMode}`}>
                {visibleDays.map((day) => {
                  const publicDay = publicByDate.get(day.key);
                  const status = publicDay?.status ?? "unavailable";
                  const isSelected = selectedDates.includes(day.key);
                  const isPast = day.key < todayKey;

                  return (
                    <button
                      className={[
                        "calendar-day",
                        "calendar-public-day",
                        `calendar-status-${status}`,
                        day.isToday ? "is-today" : "",
                        isSelected ? "is-selected" : "",
                        publicDay?.isOverride ? "is-override" : "",
                        multiSelect ? "is-multi-select-mode" : "",
                        isPast ? "is-past" : "",
                        !day.isCurrentMonth && viewMode === "month" ? "is-outside" : "",
                      ].filter(Boolean).join(" ")}
                      disabled={isPast || savingPublic}
                      key={day.key}
                      title={multiSelect ? "Select this date" : "Click to cycle public status"}
                      type="button"
                      onClick={() => {
                        if (multiSelect) {
                          toggleSelectedDate(day.key);
                        } else {
                          void cyclePublicDate(day.key, status, Boolean(publicDay?.isOverride));
                        }
                      }}
                    >
                      <span className="calendar-day-heading">
                        <span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day.date)}</span>
                        <strong>{day.date.getDate()}</strong>
                      </span>
                      <span className="calendar-public-day-copy">
                        {isPast ? (
                          <>
                            <span className="calendar-public-status-label calendar-public-status-past">
                              <i aria-hidden="true" />
                              Past
                            </span>
                            <small>Past date</small>
                          </>
                        ) : (
                          <>
                            <span className="calendar-public-status-label">
                              <i aria-hidden="true" />
                              {statusCopy[status]}
                            </span>
                            <small>{publicDay?.isOverride ? "Custom" : "Automatic"}</small>
                          </>
                        )}
                      </span>
                      {isSelected ? (
                        <span className="calendar-public-selected-mark" aria-hidden="true">
                          <Check />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {multiSelect ? (
                selectedDates.length > 0 ? (
                  <div className="calendar-selection-bar" aria-live="polite">
                    <div className="calendar-selection-count">
                      <strong>{selectedDates.length} selected</strong>
                    </div>

                    <label className="calendar-selection-status">
                      <span>Status</span>
                      <select
                        value={bulkStatus}
                        onChange={(event) => setBulkStatus(event.target.value as PublicBulkStatus)}
                      >
                        <option value="automatic">Automatic · match schedule</option>
                        <option value="available">Available</option>
                        <option value="limited">Limited</option>
                        <option value="emergencies_only">Emergency only</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </label>

                    <button
                      className="btn btn-primary"
                      disabled={savingPublic}
                      type="button"
                      onClick={() => void applySelectedStatus()}
                    >
                      Apply
                    </button>
                    <button
                      className="btn"
                      disabled={savingPublic}
                      type="button"
                      onClick={() => setSelectedDates([])}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="calendar-selection-hint is-multi">
                    Select dates to change together.
                  </div>
                )
              ) : (
                <div className="calendar-selection-hint">
                  Click a future date: <strong>Available → Limited → Emergency only → Unavailable → Automatic.</strong>
                </div>
              )}
            </>
          )}

          <p className="calendar-public-footnote">
            Customers never see Job names, client names, visit times, or private notes.
          </p>
        </section>
      </main>
    </AppLayout>

  );
}
