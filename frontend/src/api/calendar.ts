import {
  publicAvailabilityDaysResponseSchema,
  publicCalendarDayResponseSchema,
  publicCalendarDaysResponseSchema,
  publicCalendarSettingsResponseSchema,
  type PublicAvailabilityDay,
  type PublicCalendarDay,
  type PublicCalendarOverrideStatus,
  type PublicCalendarSettings,
} from "@vizow/shared";

async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload: unknown = await response.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return new Error(payload.error);
    }
  } catch {
    // Use the stable fallback below.
  }

  return new Error(fallback);
}

export async function fetchPublicCalendar(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<{ settings: PublicCalendarSettings; days: PublicCalendarDay[] }> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`/api/calendar/public?${query.toString()}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw await readError(
      response,
      `Failed to load public calendar. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = publicCalendarDaysResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid public calendar response:", result.error);
    throw new Error("The public calendar API returned an invalid response.");
  }

  return { settings: result.data.settings, days: result.data.days };
}

export async function fetchPublicAvailability(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<{ settings: PublicCalendarSettings; days: PublicAvailabilityDay[] }> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`/api/public/calendar?${query.toString()}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw await readError(
      response,
      `Failed to load availability. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = publicAvailabilityDaysResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid public availability response:", result.error);
    throw new Error("The public availability API returned an invalid response.");
  }

  return { settings: result.data.settings, days: result.data.days };
}

export async function updatePublicCalendarSettings(
  settings: PublicCalendarSettings,
): Promise<PublicCalendarSettings> {
  const response = await fetch("/api/calendar/public/settings", {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw await readError(
      response,
      `Failed to update public calendar settings. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = publicCalendarSettingsResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid public calendar settings response:", result.error);
    throw new Error("The public calendar API returned invalid settings.");
  }

  return result.data.settings;
}

export async function setPublicCalendarDayOverride(
  date: string,
  status: PublicCalendarOverrideStatus,
): Promise<PublicCalendarDay> {
  const response = await fetch(`/api/calendar/public/${encodeURIComponent(date)}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw await readError(
      response,
      `Failed to update public calendar. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = publicCalendarDayResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid public calendar day response:", result.error);
    throw new Error("The public calendar API returned an invalid day.");
  }

  return result.data.day;
}

export async function clearPublicCalendarDayOverride(
  date: string,
): Promise<PublicCalendarDay> {
  const response = await fetch(`/api/calendar/public/${encodeURIComponent(date)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw await readError(
      response,
      `Failed to clear public calendar override. HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  const result = publicCalendarDayResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid public calendar day response:", result.error);
    throw new Error("The public calendar API returned an invalid day.");
  }

  return result.data.day;
}
