import { useState } from "react";

import {
  clearSampleData,
  loadSampleData,
  type SampleRange,
} from "../api/adminSampleData";

const ranges: {
  value: SampleRange;
  label: string;
}[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Sample data action failed.";
}

export function AdminSampleDataMenu() {
  const [busy, setBusy] =
    useState<string | null>(null);

  async function load(
    range: SampleRange,
  ) {
    if (busy) return;

    setBusy(range);

    try {
      await loadSampleData(range);
      window.location.reload();
    } catch (error) {
      window.alert(errorMessage(error));
      setBusy(null);
    }
  }

  async function clear() {
    if (busy) return;

    const confirmed = window.confirm(
      "Clear ALL Vizow data? This permanently deletes every Client, Request, Job, Visit, VOW, photo, and other transactional record. This cannot be undone.",
    );

    if (!confirmed) return;

    setBusy("clear");

    try {
      await clearSampleData();
      window.location.reload();
    } catch (error) {
      window.alert(errorMessage(error));
      setBusy(null);
    }
  }

  return (
    <details className="admin-menu">
      <summary className="site-nav-link">
        Admin
      </summary>

      <div className="admin-menu-popover">
        <div className="admin-menu-heading">
          <strong>Sample Data</strong>
          <span>
            Load sample profiles · clear all transactional data
          </span>
        </div>

        {ranges.map((range) => (
          <button
            className="admin-menu-item"
            disabled={busy !== null}
            key={range.value}
            type="button"
            onClick={() =>
              void load(range.value)
            }
          >
            <span>
              {busy === range.value
                ? "Loading…"
                : `Load ${range.label}`}
            </span>
          </button>
        ))}

        <div className="admin-menu-divider" />

        <button
          className="admin-menu-item admin-menu-clear"
          disabled={busy !== null}
          type="button"
          onClick={() => void clear()}
        >
          {busy === "clear"
            ? "Clearing…"
            : "Clear All Data"}
        </button>
      </div>
    </details>
  );
}
