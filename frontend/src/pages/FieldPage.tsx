import type {
  Job,
  MediaStage,
} from "@vizow/shared";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  closeJobCycle,
  createBasicVow,
  createFieldNote,
  reopenJobCycle,
  uploadJobPhoto,
} from "../api/jobs";
import { ScopeRevisionControl } from "../components/ScopeRevisionControl";
import { VisitControl } from "../components/VisitControl";
import { useActiveJob } from "../contexts/ActiveJobContext";
import { AppLayout } from "../layouts/AppLayout";

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAddress(job: Job): string {
  const street = [
    job.serviceAddressLine1,
    job.serviceAddressLine2,
  ]
    .filter(Boolean)
    .join(", ");

  const locality = [
    job.serviceCity,
    job.serviceState,
    job.servicePostalCode,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    [street, locality].filter(Boolean).join(", ") ||
    "No service address recorded"
  );
}

export function FieldPage() {
  const {
    jobs,
    activeJob,
    activeJobId,
    status,
    error,
    selectActiveJob,
    reloadJobs,
  } = useActiveJob();

  const [isChangingJob, setIsChangingJob] = useState(false);
  const [isWritingNote, setIsWritingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [noteMessage, setNoteMessage] =
    useState<string | null>(null);

  const photoInputRef =
    useRef<HTMLInputElement>(null);
  const [photoStage, setPhotoStage] =
    useState<MediaStage>("during");
  const [photoStatus, setPhotoStatus] = useState<
    "idle" | "uploading" | "saved" | "error"
  >("idle");
  const [photoMessage, setPhotoMessage] =
    useState<string | null>(null);

  const [closeStatus, setCloseStatus] = useState<
    "idle" | "closing" | "closed" | "error"
  >("idle");
  const [closeMessage, setCloseMessage] =
    useState<string | null>(null);

  const [vowStatus, setVowStatus] = useState<
    "idle" | "generating" | "generated" | "error"
  >("idle");
  const [vowMessage, setVowMessage] =
    useState<string | null>(null);

  const [reopenStatus, setReopenStatus] = useState<
    "idle" | "reopening" | "reopened" | "error"
  >("idle");
  const [reopenMessage, setReopenMessage] =
    useState<string | null>(null);

  const showJobPicker =
    status === "ready" &&
    (!activeJob || isChangingJob);

  function handleSelectJob(jobId: string): void {
    selectActiveJob(jobId);
    setIsChangingJob(false);
    setIsWritingNote(false);
    setNoteText("");
    setNoteStatus("idle");
    setNoteMessage(null);
    setPhotoStatus("idle");
    setPhotoMessage(null);
    setCloseStatus("idle");
    setCloseMessage(null);
    setVowStatus("idle");
    setVowMessage(null);
    setReopenStatus("idle");
    setReopenMessage(null);
  }

  function handleChoosePhoto(): void {
    if (
      !activeJob ||
      photoStatus === "uploading"
    ) {
      return;
    }

    setPhotoStatus("idle");
    setPhotoMessage(null);
    photoInputRef.current?.click();
  }

  async function handlePhotoSelected(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const input = event.currentTarget;
    const photo = input.files?.[0];

    input.value = "";

    if (!activeJob || !photo) {
      return;
    }

    setPhotoStatus("uploading");
    setPhotoMessage(null);

    try {
      await uploadJobPhoto(
        activeJob.id,
        photo,
        photoStage,
      );

      setPhotoStatus("saved");
      setPhotoMessage(
        `${formatLabel(photoStage)} photo saved to ${activeJob.title}.`,
      );
    } catch (caughtError: unknown) {
      setPhotoStatus("error");
      setPhotoMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the photo.",
      );
    }
  }

  async function handleCloseCycle(): Promise<void> {
    if (
      !activeJob ||
      activeJob.currentCycle.stage !== "project" ||
      closeStatus === "closing"
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Close Cycle ${activeJob.currentCycle.cycleNumber} for ${activeJob.title}?`,
    );

    if (!confirmed) {
      return;
    }

    setCloseStatus("closing");
    setCloseMessage(null);

    try {
      await closeJobCycle(activeJob.id, {
        finalPrice: null,
        notes: null,
      });

      setCloseStatus("closed");
      setCloseMessage(
        `Cycle ${activeJob.currentCycle.cycleNumber} closed.`,
      );

      setReopenStatus("idle");
      setReopenMessage(null);
      setIsWritingNote(false);
      setNoteText("");
      setNoteStatus("idle");
      setNoteMessage(null);
      setPhotoStatus("idle");
      setPhotoMessage(null);

      reloadJobs();
    } catch (caughtError: unknown) {
      setCloseStatus("error");
      setCloseMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to close the work cycle.",
      );
    }
  }

  async function handleGenerateVow(): Promise<void> {
    if (
      !activeJob ||
      activeJob.currentCycle.stage !== "completed" ||
      vowStatus === "generating"
    ) {
      return;
    }

    setVowStatus("generating");
    setVowMessage(null);

    try {
      const vow = await createBasicVow(activeJob.id);

      setVowStatus("generated");
      setVowMessage(`Draft VOW ready: ${vow.title}.`);
    } catch (caughtError: unknown) {
      setVowStatus("error");
      setVowMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate the VOW.",
      );
    }
  }

  async function handleReopenCycle(): Promise<void> {
    if (
      !activeJob ||
      activeJob.currentCycle.stage !== "completed" ||
      reopenStatus === "reopening"
    ) {
      return;
    }

    const currentCycleNumber =
      activeJob.currentCycle.cycleNumber;
    const nextCycleNumber = currentCycleNumber + 1;

    const confirmed = window.confirm(
      `Reopen ${activeJob.title} as Cycle ${nextCycleNumber}? Cycle ${currentCycleNumber} will remain closed.`,
    );

    if (!confirmed) {
      return;
    }

    setReopenStatus("reopening");
    setReopenMessage(null);

    try {
      const reopenedJob = await reopenJobCycle(
        activeJob.id,
      );

      setReopenStatus("reopened");
      setReopenMessage(
        `Cycle ${reopenedJob.currentCycle.cycleNumber} opened.`,
      );
      setCloseStatus("idle");
      setCloseMessage(null);
      setVowStatus("idle");
      setVowMessage(null);

      reloadJobs();
    } catch (caughtError: unknown) {
      setReopenStatus("error");
      setReopenMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reopen the work cycle.",
      );
    }
  }

  async function handleSubmitNote(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      !activeJob ||
      noteStatus === "saving" ||
      noteText.trim().length === 0
    ) {
      return;
    }

    setNoteStatus("saving");
    setNoteMessage(null);

    try {
      await createFieldNote(activeJob.id, {
        content: noteText,
      });

      setNoteText("");
      setIsWritingNote(false);
      setNoteStatus("saved");
      setNoteMessage("Field note saved.");
    } catch (caughtError: unknown) {
      setNoteStatus("error");
      setNoteMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the field note.",
      );
    }
  }

  return (
    <AppLayout
      object={activeJob?.title ?? "No Job Selected"}
      tool="Field"
      action={
        activeJob
          ? "Capture work"
          : "Select a job"
      }
      result={
        status === "loading"
          ? "Loading"
          : status === "error"
            ? "Not loaded"
            : activeJob
              ? `Cycle ${activeJob.currentCycle.cycleNumber}`
              : "Selection required"
      }
      message={
        status === "loading"
          ? "Loading the available jobs."
          : status === "error"
            ? "Jobs could not be loaded. Nothing was changed."
            : activeJob
              ? `${activeJob.title} is the active field job.`
              : "Select a job before recording field work."
      }
      activeStep={
        status === "loading"
          ? "result"
          : activeJob
            ? "action"
            : "object"
      }
      resultTone={
        status === "loading"
          ? "working"
          : status === "error"
            ? "error"
            : activeJob
              ? "success"
              : undefined
      }
    >
      <div className="page field-page">
        <section
          className="field-workspace"
          aria-live="polite"
        >
          {status === "loading" && (
            <div className="notice">
              Loading field jobs…
            </div>
          )}

          {status === "error" && (
            <div
              className="notice notice-error field-error-panel"
              role="alert"
            >
              <strong>Jobs could not be loaded.</strong>
              <p>
                {error ??
                  "An unknown error occurred while loading jobs."}
              </p>

              <button
                className="btn"
                type="button"
                onClick={reloadJobs}
              >
                Try Again
              </button>
            </div>
          )}

          {status === "ready" && jobs.length === 0 && (
            <div className="field-empty-state">
              <p className="eyebrow">Field Work</p>
              <h1>No Jobs Available</h1>
              <p>
                Approve a Request to create a Job and
                Cycle 1.
              </p>
            </div>
          )}

          {showJobPicker && jobs.length > 0 && (
            <section className="field-job-picker">
              <header className="field-section-heading">
                <div>
                  <p className="eyebrow">
                    Active Field Job
                  </p>
                  <h1>
                    {activeJob
                      ? "Change Job"
                      : "Select a Job"}
                  </h1>
                </div>

                {activeJob && (
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setIsChangingJob(false)
                    }
                  >
                    Cancel
                  </button>
                )}
              </header>

              <div className="field-job-list">
                {jobs.map((job) => {
                  const isSelected =
                    job.id === activeJobId;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={
                        isSelected
                          ? "field-job-option field-job-option-selected"
                          : "field-job-option"
                      }
                      key={job.id}
                      type="button"
                      onClick={() =>
                        handleSelectJob(job.id)
                      }
                    >
                      <span className="field-job-option-client">
                        {job.clientName}
                      </span>

                      <strong>{job.title}</strong>

                      <span>
                        {formatAddress(job)}
                      </span>

                      <small>
                        Cycle{" "}
                        {job.currentCycle.cycleNumber}
                        {" · "}
                        {formatLabel(
                          job.currentCycle.stage,
                        )}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {status === "ready" &&
            activeJob &&
            !isChangingJob && (
              <>
                <section className="field-active-job">
                  <div className="field-active-job-top">
                    <div>
                      <p className="eyebrow">
                        Active Field Job
                      </p>
                      <h1>{activeJob.title}</h1>
                    </div>

                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        setIsChangingJob(true)
                      }
                    >
                      Change Job
                    </button>
                  </div>

                  <dl className="field-job-details">
                    <div>
                      <dt>Client</dt>
                      <dd>{activeJob.clientName}</dd>
                    </div>

                    <div>
                      <dt>Address</dt>
                      <dd>
                        {formatAddress(activeJob)}
                      </dd>
                    </div>

                    <div>
                      <dt>Cycle</dt>
                      <dd>
                        {
                          activeJob.currentCycle
                            .cycleNumber
                        }
                      </dd>
                    </div>

                    <div>
                      <dt>Stage</dt>
                      <dd>
                        {formatLabel(
                          activeJob.currentCycle.stage,
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section
                  className="field-photo-settings"
                  aria-label="Photo settings"
                >
                  <label htmlFor="field-photo-stage">
                    Photo Type
                  </label>

                  <select
                    disabled={
                      photoStatus === "uploading" ||
                      activeJob.currentCycle.stage !==
                        "project"
                    }
                    id="field-photo-stage"
                    value={photoStage}
                    onChange={(event) =>
                      setPhotoStage(
                        event.target
                          .value as MediaStage,
                      )
                    }
                  >
                    <option value="before">
                      Before
                    </option>
                    <option value="during">
                      During
                    </option>
                    <option value="after">
                      After
                    </option>
                  </select>

                  <span>
                    Automatically attaches to{" "}
                    <strong>{activeJob.title}</strong>
                    {" · "}
                    {activeJob.clientName}
                  </span>
                </section>

                <input
                  ref={photoInputRef}
                  accept="image/*"
                  capture="environment"
                  className="field-photo-input"
                  type="file"
                  onChange={handlePhotoSelected}
                />

                <section
                  className="field-action-grid"
                  aria-label="Field actions"
                >
                  <button
                    className="field-action field-action-primary"
                    disabled={
                      photoStatus === "uploading" ||
                      activeJob.currentCycle.stage !==
                        "project"
                    }
                    type="button"
                    onClick={handleChoosePhoto}
                  >
                    <strong>
                      {photoStatus === "uploading"
                        ? "Uploading…"
                        : "Take Picture"}
                    </strong>

                    <span>
                      {formatLabel(photoStage)}
                      {" · "}
                      {activeJob.clientName}
                    </span>
                  </button>

                  <button
                    aria-expanded={isWritingNote}
                    className="field-action"
                    disabled={
                      activeJob.currentCycle.stage !==
                        "project"
                    }
                    type="button"
                    onClick={() => {
                      setIsWritingNote(true);
                      setNoteStatus("idle");
                      setNoteMessage(null);
                    }}
                  >
                    <strong>Field Note</strong>
                    <span>Record work immediately</span>
                  </button>
                </section>

                <ScopeRevisionControl
                  key={`${activeJob.id}:${activeJob.currentCycle.id}:${activeJob.currentCycle.stage}`}
                  job={activeJob}
                />

                <VisitControl
                  key={`visits:${activeJob.id}:${activeJob.currentCycle.id}:${activeJob.currentCycle.stage}`}
                  job={activeJob}
                />

                <div className="field-note-actions">
                  <button
                    className="btn btn-primary"
                    disabled={
                      activeJob.currentCycle.stage !==
                        "project" ||
                      closeStatus === "closing"
                    }
                    type="button"
                    onClick={handleCloseCycle}
                  >
                    {activeJob.currentCycle.stage ===
                    "completed"
                      ? "Cycle Closed"
                      : closeStatus === "closing"
                        ? "Closing…"
                        : "Close Work Cycle"}
                  </button>

                  <button
                    className="btn btn-primary"
                    disabled={
                      activeJob.currentCycle.stage !==
                        "completed" ||
                      vowStatus === "generating" ||
                      vowStatus === "generated"
                    }
                    type="button"
                    onClick={handleGenerateVow}
                  >
                    {vowStatus === "generating"
                      ? "Generating…"
                      : vowStatus === "generated"
                        ? "VOW Ready"
                        : "Generate Basic VOW"}
                  </button>

                  <button
                    className="btn btn-primary"
                    disabled={
                      activeJob.currentCycle.stage !==
                        "completed" ||
                      reopenStatus === "reopening" ||
                      reopenStatus === "reopened"
                    }
                    type="button"
                    onClick={handleReopenCycle}
                  >
                    {reopenStatus === "reopening"
                      ? "Reopening…"
                      : reopenStatus === "reopened"
                        ? "New Cycle Open"
                        : `Reopen as Cycle ${
                            activeJob.currentCycle
                              .cycleNumber + 1
                          }`}
                  </button>
                </div>

                {reopenMessage && (
                  <div
                    className={
                      reopenStatus === "error"
                        ? "notice notice-error"
                        : "notice notice-success"
                    }
                    role={
                      reopenStatus === "error"
                        ? "alert"
                        : "status"
                    }
                  >
                    <strong>{reopenMessage}</strong>
                  </div>
                )}

                {vowMessage && (
                  <div
                    className={
                      vowStatus === "error"
                        ? "notice notice-error"
                        : "notice notice-success"
                    }
                    role={
                      vowStatus === "error"
                        ? "alert"
                        : "status"
                    }
                  >
                    <strong>{vowMessage}</strong>
                  </div>
                )}

                {closeMessage && (
                  <div
                    className={
                      closeStatus === "error"
                        ? "notice notice-error"
                        : "notice notice-success"
                    }
                    role={
                      closeStatus === "error"
                        ? "alert"
                        : "status"
                    }
                  >
                    <strong>{closeMessage}</strong>
                  </div>
                )}

                {photoMessage && (
                  <div
                    className={
                      photoStatus === "error"
                        ? "notice notice-error"
                        : "notice notice-success"
                    }
                    role={
                      photoStatus === "error"
                        ? "alert"
                        : "status"
                    }
                  >
                    <strong>{photoMessage}</strong>
                  </div>
                )}

                {isWritingNote && (
                  <section className="field-note-panel">
                    <form
                      className="field-note-form"
                      onSubmit={handleSubmitNote}
                    >
                      <label
                        className="field-note-field"
                        htmlFor="field-note-content"
                      >
                        <span>Field Note</span>

                        <textarea
                          autoFocus
                          className="textarea"
                          disabled={noteStatus === "saving"}
                          id="field-note-content"
                          placeholder="What happened on this job?"
                          required
                          value={noteText}
                          onChange={(event) =>
                            setNoteText(event.target.value)
                          }
                        />
                      </label>

                      <div className="field-note-actions">
                        <button
                          className="btn"
                          disabled={noteStatus === "saving"}
                          type="button"
                          onClick={() => {
                            setIsWritingNote(false);
                            setNoteText("");
                            setNoteStatus("idle");
                            setNoteMessage(null);
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          className="btn btn-primary"
                          disabled={
                            noteStatus === "saving" ||
                            noteText.trim().length === 0
                          }
                          type="submit"
                        >
                          {noteStatus === "saving"
                            ? "Saving…"
                            : "Save Field Note"}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                {noteMessage && (
                  <div
                    className={
                      noteStatus === "error"
                        ? "notice notice-error"
                        : "notice notice-success"
                    }
                    role={
                      noteStatus === "error"
                        ? "alert"
                        : "status"
                    }
                  >
                    <strong>{noteMessage}</strong>
                  </div>
                )}
              </>
            )}
        </section>
      </div>
    </AppLayout>
  );
}
