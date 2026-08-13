export type CalendarViewMode = "week" | "month";

export type CalendarDay = {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

export function addMonths(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(1);
  next.setMonth(next.getMonth() + amount);
  return startOfDay(next);
}

export function startOfWeek(value: Date): Date {
  const start = startOfDay(value);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return start;
}

export function startOfMonthGrid(value: Date): Date {
  return startOfWeek(new Date(value.getFullYear(), value.getMonth(), 1));
}

export function visibleCalendarDays(
  anchorDate: Date,
  mode: CalendarViewMode,
): CalendarDay[] {
  const todayKey = localDateKey(new Date());
  const start = mode === "week" ? startOfWeek(anchorDate) : startOfMonthGrid(anchorDate);
  const count = mode === "week" ? 7 : 42;

  return Array.from({ length: count }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: localDateKey(date),
      date,
      isCurrentMonth: date.getMonth() === anchorDate.getMonth(),
      isToday: localDateKey(date) === todayKey,
    };
  });
}

export function calendarRange(
  anchorDate: Date,
  mode: CalendarViewMode,
): { from: string; to: string } {
  const days = visibleCalendarDays(anchorDate, mode);
  return {
    from: days[0]?.key ?? localDateKey(anchorDate),
    to: days[days.length - 1]?.key ?? localDateKey(anchorDate),
  };
}

export function calendarTitle(anchorDate: Date, mode: CalendarViewMode): string {
  if (mode === "month") {
    return new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(anchorDate);
  }

  const start = startOfWeek(anchorDate);
  const end = addDays(start, 6);
  const startMonth = new Intl.DateTimeFormat(undefined, { month: "short" }).format(start);
  const endMonth = new Intl.DateTimeFormat(undefined, { month: "short" }).format(end);

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }

  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

export function moveCalendarAnchor(
  anchorDate: Date,
  mode: CalendarViewMode,
  direction: -1 | 1,
): Date {
  return mode === "week"
    ? addDays(anchorDate, direction * 7)
    : addMonths(anchorDate, direction);
}

export function formatCalendarDayHeading(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}
