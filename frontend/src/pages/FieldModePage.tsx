import type { MediaStage } from "@vizow/shared";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router";
import {
  BellRing,
  Calculator,
  Camera,
  ChevronRight,
  ClipboardList,
  MapPin,
  NotebookPen,
  X,
} from "lucide-react";

import {
  createFieldNote,
  uploadJobPhoto,
} from "../api/jobs";
import { fetchRequests } from "../api/requests";
import { FieldModeMediaLibrary } from "../components/FieldModeMediaLibrary";
import { useActiveJob } from "../contexts/ActiveJobContext";

function formatAddress(
  line1: string | null,
  city: string | null,
  state: string | null,
  postalCode: string | null,
) {
  const locality = [city, state, postalCode]
    .filter(Boolean)
    .join(" ");

  return [line1, locality]
    .filter(Boolean)
    .join(" · ");
}

function formatStartedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function FieldModePage() {
  const navigate = useNavigate();
  const { activeJob, status } = useActiveJob();

  const photoInputRef = useRef<HTMLInputElement>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoStage, setPhotoStage] =
    useState<MediaStage>("during");
  const [photoStatus, setPhotoStatus] = useState<
    "idle" | "uploading" | "saved" | "error"
  >("idle");
  const [photoMessage, setPhotoMessage] =
    useState<string | null>(null);

  const [notesOpen, setNotesOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [mediaRefreshVersion, setMediaRefreshVersion] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [noteMessage, setNoteMessage] =
    useState<string | null>(null);
  const [openRequestCount, setOpenRequestCount] =
    useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchRequests(controller.signal)
      .then((requests) => {
        setOpenRequestCount(
          requests.filter((request) => request.status === "open").length,
        );
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setOpenRequestCount(null);
      });

    return () => controller.abort();
  }, []);

  const address = activeJob
    ? formatAddress(
        activeJob.serviceAddressLine1,
        activeJob.serviceCity,
        activeJob.serviceState,
        activeJob.servicePostalCode,
      )
    : "";

  const activeJobIsWritable =
    activeJob !== null &&
    activeJob.lifecycleStatus === "active" &&
    activeJob.archivedAt === null &&
    activeJob.currentCycle.stage === "open";

  const requestMessage =
    openRequestCount === null
      ? "CHECK INBOX"
      : openRequestCount === 0
        ? "INBOX CLEAR"
        : `${openRequestCount} ${openRequestCount === 1 ? "REQUEST" : "REQUESTS"} WAITING`;

  function openCamera(): void {
    if (!activeJobIsWritable) {
      return;
    }

    setPhotoStatus("idle");
    setPhotoMessage(null);
    setCameraOpen(true);
  }

  function closeCamera(): void {
    if (photoStatus === "uploading") {
      return;
    }

    setCameraOpen(false);
  }

  function choosePhoto(): void {
    if (
      !activeJobIsWritable ||
      photoStatus === "uploading"
    ) {
      return;
    }

    photoInputRef.current?.click();
  }

  async function handlePhotoSelected(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const input = event.currentTarget;
    const photo = input.files?.[0];

    input.value = "";

    if (
      !activeJob ||
      !activeJobIsWritable ||
      !photo
    ) {
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

      setMediaRefreshVersion((current) => current + 1);
      setPhotoStatus("saved");
      setPhotoMessage(
        `${photoStage} photo saved to ${activeJob.title}.`,
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

  function openNotes(): void {
    if (!activeJobIsWritable) {
      return;
    }

    setNoteStatus("idle");
    setNoteMessage(null);
    setNotesOpen(true);
  }

  function closeNotes(): void {
    if (noteStatus === "saving") {
      return;
    }

    setNotesOpen(false);
  }

  async function handleSubmitNote(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      !activeJob ||
      !activeJobIsWritable ||
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
    <main className="site-mode">
      <header className="site-mode-header">
        <div className="site-mode-header-top">
          <Link className="site-mode-brand" to="/app/today">
            <strong>VIZOW</strong>
            <span>FIELD MODE</span>
          </Link>

          <span
            className={`site-mode-active-badge${activeJobIsWritable ? " is-active" : ""}`}
          >
            <i />
            {activeJobIsWritable ? "ACTIVE" : "STANDBY"}
          </span>
        </div>

        <p className="site-mode-job-kicker">
          {activeJob ? "ACTIVE JOB" : "FIELD WORK"}
        </p>

        <button
          className="site-mode-job-hero"
          type="button"
          disabled={!activeJob}
          onClick={() => {
            if (activeJob) {
              navigate(`/app/jobs/${encodeURIComponent(activeJob.id)}`);
            }
          }}
        >
          <span className="site-mode-job-title">
            {activeJob
              ? activeJob.title
              : status === "loading"
                ? "Loading job…"
                : "No active job"}
          </span>

          <span className="site-mode-job-address">
            <MapPin aria-hidden="true" />
            {activeJob
              ? address || activeJob.clientName
              : "Open Today to choose the work in front of you."}
          </span>
        </button>

        <div className="site-mode-job-meta" aria-label="Current job details">
          <span>
            <small>Client</small>
            <strong>{activeJob?.clientName ?? "—"}</strong>
          </span>
          <span>
            <small>Started</small>
            <strong>
              {activeJob
                ? formatStartedAt(activeJob.currentCycle.openedAt)
                : "—"}
            </strong>
          </span>
          <span>
            <small>Cycle</small>
            <strong>
              {activeJob
                ? `#${activeJob.currentCycle.cycleNumber}`
                : "—"}
            </strong>
          </span>
        </div>

        <div className="site-mode-hazard-rule" />
      </header>

      <section
        className="site-mode-grid"
        aria-label="Field tools"
      >
        <button
          className="site-mode-tile"
          data-index="01"
          type="button"
          disabled={!activeJob}
          onClick={() => setJobOpen(true)}
        >
          <ClipboardList aria-hidden="true" strokeWidth={1.65} />
          <strong>Today / Job</strong>
          <span>Schedule, details &amp; history</span>
        </button>

        <button
          className="site-mode-tile"
          data-index="02"
          type="button"
          disabled={!activeJobIsWritable}
          onClick={openCamera}
        >
          <Camera aria-hidden="true" strokeWidth={1.65} />
          <strong>Camera</strong>
          <span>Take photos &amp; video</span>
        </button>

        <button
          className="site-mode-tile"
          data-index="03"
          type="button"
          disabled={!activeJobIsWritable}
          onClick={openNotes}
        >
          <NotebookPen aria-hidden="true" strokeWidth={1.65} />
          <strong>Notes</strong>
          <span>Field notes &amp; observations</span>
        </button>

        <button
          className="site-mode-tile"
          data-index="04"
          type="button"
          onClick={() => navigate("/app/nailed-it")}
        >
          <Calculator aria-hidden="true" strokeWidth={1.65} />
          <strong>Calculators</strong>
          <span>Roofing, area, pitch &amp; more</span>
        </button>
      </section>

      <button
        className={`site-mode-inbox-alert${openRequestCount === 0 ? " is-clear" : ""}`}
        type="button"
        onClick={() => navigate("/app/inbox")}
      >
        <span className="site-mode-inbox-icon">
          <BellRing aria-hidden="true" />
        </span>
        <span>
          <small>
            {openRequestCount && openRequestCount > 0
              ? "ATTENTION REQUIRED"
              : "INBOX"}
          </small>
          <strong>{requestMessage}</strong>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>

      <input
        ref={photoInputRef}
        accept="image/*"
        capture="environment"
        className="site-mode-file-input"
        type="file"
        onChange={handlePhotoSelected}
      />

      {jobOpen && activeJob ? (
        <>
          <button
            className="site-mode-scrim"
            type="button"
            aria-label="Close current job"
            onClick={() => setJobOpen(false)}
          />

          <section
            className="site-mode-sheet site-mode-media-sheet site-mode-job-sheet"
            aria-label="Current job"
          >
            <div className="site-mode-sheet-handle" />

            <header className="site-mode-sheet-header">
              <div>
                <small className="site-mode-sheet-kicker">CURRENT JOB</small>
                <h2>{activeJob.title}</h2>
                <p>{address || activeJob.clientName}</p>
              </div>

              <button
                className="site-mode-sheet-close"
                type="button"
                aria-label="Close current job"
                onClick={() => setJobOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="site-mode-job-actions">
              <button
                type="button"
                onClick={() => navigate(`/app/jobs/${encodeURIComponent(activeJob.id)}`)}
              >
                Open Job
                <ChevronRight aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/app/today")}
              >
                Today
                <ChevronRight aria-hidden="true" />
              </button>
            </div>

            <div className="site-mode-job-media-heading">
              <span>JOB MEDIA</span>
              <small>Photos attached to this Job</small>
            </div>

            <FieldModeMediaLibrary
              jobId={activeJob.id}
              refreshKey={mediaRefreshVersion}
            />
          </section>
        </>
      ) : null}

      {notesOpen ? (
        <>
          <button
            className="site-mode-scrim"
            type="button"
            aria-label="Close notes"
            onClick={closeNotes}
          />

          <section
            className="site-mode-sheet"
            aria-label="Field note"
          >
            <div className="site-mode-sheet-handle" />

            <header className="site-mode-sheet-header">
              <h2>Field Note</h2>

              <button
                className="site-mode-sheet-close"
                type="button"
                aria-label="Close notes"
                disabled={noteStatus === "saving"}
                onClick={closeNotes}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <form
              className="site-mode-note-form"
              onSubmit={handleSubmitNote}
            >
              <textarea
                value={noteText}
                placeholder="What happened on this job?"
                disabled={noteStatus === "saving"}
                onChange={(event) =>
                  setNoteText(event.target.value)
                }
              />

              <button
                className="site-mode-primary-action"
                type="submit"
                disabled={
                  noteStatus === "saving" ||
                  noteText.trim().length === 0
                }
              >
                {noteStatus === "saving"
                  ? "Saving…"
                  : "Save Note"}
              </button>

              {noteMessage ? (
                <p
                  className={`site-mode-status site-mode-status-${noteStatus}`}
                >
                  {noteMessage}
                </p>
              ) : null}
            </form>
          </section>
        </>
      ) : null}

      {cameraOpen ? (
        <>
          <button
            className="site-mode-scrim"
            type="button"
            aria-label="Close camera"
            onClick={closeCamera}
          />

          <section
            className="site-mode-sheet"
            aria-label="Camera"
          >
            <div className="site-mode-sheet-handle" />

            <header className="site-mode-sheet-header">
              <h2>Camera</h2>

              <button
                className="site-mode-sheet-close"
                type="button"
                aria-label="Close camera"
                disabled={photoStatus === "uploading"}
                onClick={closeCamera}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <div
              className="site-mode-stage"
              aria-label="Photo stage"
            >
              {(["before", "during", "after"] as const).map(
                (stage) => (
                  <button
                    key={stage}
                    className={
                      photoStage === stage
                        ? "active"
                        : undefined
                    }
                    type="button"
                    disabled={photoStatus === "uploading"}
                    onClick={() => setPhotoStage(stage)}
                  >
                    {stage}
                  </button>
                ),
              )}
            </div>

            <div className="site-mode-camera-body">
              <Camera aria-hidden="true" strokeWidth={1.4} />

              <p>
                Photo saves directly to{" "}
                <strong>{activeJob?.title}</strong>.
              </p>

              <button
                className="site-mode-primary-action"
                type="button"
                disabled={photoStatus === "uploading"}
                onClick={choosePhoto}
              >
                {photoStatus === "uploading"
                  ? "Saving…"
                  : "Take Photo"}
              </button>

              {photoMessage ? (
                <p
                  className={`site-mode-status site-mode-status-${photoStatus}`}
                >
                  {photoMessage}
                </p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
