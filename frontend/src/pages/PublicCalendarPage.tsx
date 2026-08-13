import type {
  PublicAvailabilityDay,
  PublicCalendarSettings,
  PublicCalendarStatus,
} from "@vizow/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { fetchPublicAvailability } from "../api/calendar";
import { useOrganization } from "../contexts/OrganizationContext";
import {
  calendarRange,
  calendarTitle,
  formatCalendarDayHeading,
  moveCalendarAnchor,
  visibleCalendarDays,
  type CalendarViewMode,
} from "../lib/calendar";

const statusCopy: Record<
  PublicCalendarStatus,
  { label: string; description: string; canRequest: boolean }
> = {
  available: {
    label: "Available",
    description: "A good day to send a work request.",
    canRequest: true,
  },
  limited: {
    label: "Limited",
    description: "Some work is already booked. Send the request and timing will be confirmed.",
    canRequest: true,
  },
  emergencies_only: {
    label: "Emergency only",
    description: "Weekend availability is reserved for urgent work. Send the request and the contractor will confirm.",
    canRequest: true,
  },
  unavailable: {
    label: "Unavailable",
    description: "No public availability is being shown for this day.",
    canRequest: false,
  },
};

type PageState =
  | { status: "loading"; settings: PublicCalendarSettings | null; days: PublicAvailabilityDay[] }
  | { status: "ready"; settings: PublicCalendarSettings; days: PublicAvailabilityDay[] }
  | { status: "error"; settings: PublicCalendarSettings | null; days: PublicAvailabilityDay[]; message: string };


export function PublicCalendarPage() {
  const { organization } = useOrganization();
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [state, setState] = useState<PageState>({
    status: "loading",
    settings: null,
    days: [],
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const visibleDays = useMemo(
    () => visibleCalendarDays(anchorDate, viewMode),
    [anchorDate, viewMode],
  );
  const range = useMemo(
    () => calendarRange(anchorDate, viewMode),
    [anchorDate, viewMode],
  );
  const daysByDate = useMemo(
    () => new Map(state.days.map((day) => [day.date, day])),
    [state.days],
  );
  const selectedDay = selectedDate ? daysByDate.get(selectedDate) ?? null : null;

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({
      status: "loading",
      settings: current.settings,
      days: current.days,
    }));

    fetchPublicAvailability(range.from, range.to, controller.signal)
      .then(({ settings, days }) => {
        setState({ status: "ready", settings, days });
        setSelectedDate((current) =>
          current && days.some((day) => day.date === current) ? current : null,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((current) => ({
          status: "error",
          settings: current.settings,
          days: current.days,
          message: error instanceof Error ? error.message : "Unable to load availability.",
        }));
      });

    return () => controller.abort();
  }, [range.from, range.to]);

  function move(direction: -1 | 1): void {
    setAnchorDate((current) => moveCalendarAnchor(current, viewMode, direction));
    setSelectedDate(null);
  }

  const isEnabled = state.settings?.enabled ?? true;

  return (
    <main className="public-calendar-page">
      <div className="public-calendar-shell">
        <header className="public-calendar-header">
          <Link className="public-calendar-brand" to="/request">
            <img src="/icons/vizow-icon.svg" alt="" />
            <span>{organization?.name ?? "VIZOW"}</span>
          </Link>

          <div className="public-calendar-header-copy">
            <p className="eyebrow">Public calendar</p>
            <h1>Availability</h1>
            <p>
              A quick reference before you send a request. Availability is not a reservation; the contractor confirms timing after reviewing your request.
            </p>
          </div>

          <Link className="btn btn-primary" to="/request">Send a request</Link>
        </header>

        {state.status === "error" ? (
          <div className="notice notice-error">{state.message}</div>
        ) : null}

        {!isEnabled ? (
          <section className="public-calendar-hidden">
            <p className="eyebrow">Availability</p>
            <h2>Calendar not currently shown</h2>
            <p>You can still send a request. The contractor will review it and follow up about timing.</p>
            <Link className="btn btn-primary" to="/request">Send a request</Link>
          </section>
        ) : (
          <>
            <section className="public-calendar-controls" aria-label="Calendar controls">
              <div className="calendar-view-toggle">
                <button
                  className={viewMode === "week" ? "is-active" : undefined}
                  type="button"
                  onClick={() => {
                    setViewMode("week");
                    setSelectedDate(null);
                  }}
                >
                  Week
                </button>
                <button
                  className={viewMode === "month" ? "is-active" : undefined}
                  type="button"
                  onClick={() => {
                    setViewMode("month");
                    setSelectedDate(null);
                  }}
                >
                  Month
                </button>
              </div>

              <div className="calendar-period-nav">
                <button aria-label="Previous period" type="button" onClick={() => move(-1)}>
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnchorDate(new Date());
                    setSelectedDate(null);
                  }}
                >
                  Today
                </button>
                <button aria-label="Next period" type="button" onClick={() => move(1)}>
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <strong className="calendar-period-title">
                {calendarTitle(anchorDate, viewMode)}
              </strong>
            </section>

            <div className={`calendar-grid public-reference-grid calendar-grid-${viewMode}`}>
              {visibleDays.map((day) => {
                const availability = daysByDate.get(day.key);
                const status = availability?.status ?? "unavailable";
                const isSelected = selectedDate === day.key;

                return (
                  <button
                    className={[
                      "calendar-day",
                      "public-reference-day",
                      `calendar-status-${status}`,
                      day.isToday ? "is-today" : "",
                      isSelected ? "is-selected" : "",
                      !day.isCurrentMonth && viewMode === "month" ? "is-outside" : "",
                    ].filter(Boolean).join(" ")}
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedDate(day.key)}
                  >
                    <span className="calendar-day-heading">
                      <span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day.date)}</span>
                      <strong>{day.date.getDate()}</strong>
                    </span>
                    <span className="public-reference-status">
                      <i aria-hidden="true" />
                      <span>{statusCopy[status].label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <aside className="public-calendar-detail" aria-live="polite">
              {selectedDay ? (
                <>
                  <div>
                    <p className="eyebrow">Selected day</p>
                    <h2>{formatCalendarDayHeading(new Date(`${selectedDay.date}T12:00:00`))}</h2>
                    <strong className={`public-calendar-detail-status calendar-status-${selectedDay.status}`}>
                      <i aria-hidden="true" />
                      {statusCopy[selectedDay.status].label}
                    </strong>
                    <p>{statusCopy[selectedDay.status].description}</p>
                  </div>

                  <Link
                    className={statusCopy[selectedDay.status].canRequest ? "btn btn-primary" : "btn"}
                    to={
                      statusCopy[selectedDay.status].canRequest
                        ? `/request?preferredDate=${encodeURIComponent(selectedDay.date)}`
                        : "/request"
                    }
                  >
                    {statusCopy[selectedDay.status].canRequest
                      ? "Send request for this day"
                      : "Send a general request"}
                  </Link>
                </>
              ) : (
                <>
                  <div>
                    <p className="eyebrow">Reference only</p>
                    <h2>Pick a day</h2>
                    <p>Availability helps set expectations. Your request is still reviewed before any visit is scheduled.</p>
                  </div>
                  <Link className="btn btn-primary" to="/request">Send a request</Link>
                </>
              )}
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
