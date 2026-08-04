import type { Job } from "@vizow/shared";
import {
  useState,
  type FormEvent,
} from "react";

import { createScopeRevision } from "../api/jobs";

type ScopeRevisionControlProps = {
  job: Job;
};

export function ScopeRevisionControl({
  job,
}: ScopeRevisionControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scopeText, setScopeText] = useState("");
  const [priceChange, setPriceChange] = useState("0");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] =
    useState<string | null>(null);

  const isActive =
    job.currentCycle.stage === "project";
  const isSaving = status === "saving";

  function closeForm(): void {
    setIsOpen(false);
    setScopeText("");
    setPriceChange("0");
    setReason("");
    setStatus("idle");
    setMessage(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      !isActive ||
      isSaving ||
      scopeText.trim().length === 0
    ) {
      return;
    }

    const parsedPriceChange =
      priceChange.trim().length === 0
        ? 0
        : Number(priceChange);

    if (!Number.isFinite(parsedPriceChange)) {
      setStatus("error");
      setMessage(
        "Price change must be a valid number.",
      );
      return;
    }

    setStatus("saving");
    setMessage(null);

    try {
      const revision = await createScopeRevision(
        job.id,
        {
          scopeText,
          priceChange: parsedPriceChange,
          reason,
        },
      );

      setIsOpen(false);
      setScopeText("");
      setPriceChange("0");
      setReason("");
      setStatus("saved");
      setMessage(
        `Scope Revision ${revision.revisionNumber} saved.`,
      );

    } catch (caughtError: unknown) {
      setStatus("error");
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the scope revision.",
      );
    }
  }

  return (
    <>
      <div className="field-note-actions">
        <button
          aria-expanded={isOpen}
          className="btn"
          disabled={!isActive || isSaving}
          type="button"
          onClick={() => {
            setIsOpen(true);
            setStatus("idle");
            setMessage(null);
          }}
        >
          {isActive
            ? "Add Scope Revision"
            : "Scope Locked"}
        </button>
      </div>

      {isOpen && (
        <section className="field-note-panel">
          <form
            className="field-note-form"
            onSubmit={handleSubmit}
          >
            <label
              className="field-note-field"
              htmlFor="scope-revision-text"
            >
              <span>Revised Scope</span>

              <textarea
                autoFocus
                className="textarea"
                disabled={isSaving}
                id="scope-revision-text"
                placeholder="What work changed?"
                required
                value={scopeText}
                onChange={(event) =>
                  setScopeText(event.target.value)
                }
              />
            </label>

            <label
              className="field-note-field"
              htmlFor="scope-price-change"
            >
              <span>Price Change</span>

              <input
                className="input"
                disabled={isSaving}
                id="scope-price-change"
                inputMode="decimal"
                step="0.01"
                type="number"
                value={priceChange}
                onChange={(event) =>
                  setPriceChange(event.target.value)
                }
              />
            </label>

            <label
              className="field-note-field"
              htmlFor="scope-reason"
            >
              <span>Reason — Optional</span>

              <input
                className="input"
                disabled={isSaving}
                id="scope-reason"
                placeholder="Why did the work change?"
                type="text"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
              />
            </label>

            <div className="field-note-actions">
              <button
                className="btn"
                disabled={isSaving}
                type="button"
                onClick={closeForm}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                disabled={
                  isSaving ||
                  scopeText.trim().length === 0
                }
                type="submit"
              >
                {isSaving
                  ? "Saving…"
                  : "Save Scope Revision"}
              </button>
            </div>
          </form>
        </section>
      )}

      {message && (
        <div
          className={
            status === "error"
              ? "notice notice-error"
              : "notice notice-success"
          }
          role={
            status === "error"
              ? "alert"
              : "status"
          }
        >
          <strong>{message}</strong>
        </div>
      )}
    </>
  );
}
