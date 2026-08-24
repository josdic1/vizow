import type { MediaStage } from "@vizow/shared";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";
import {
  Calculator,
  Camera,
  ClipboardList,
  LogOut,
  NotebookPen,
  X,
} from "lucide-react";

import {
  createFieldNote,
  uploadJobPhoto,
} from "../api/jobs";
import { FieldModeMediaLibrary } from "../components/FieldModeMediaLibrary";
import { useActiveJob } from "../contexts/ActiveJobContext";

function formatAddress(
  line1: string | null,
  city: string | null,
  state: string | null,
  postalCode: string | null,
) {
  const locality = [city, state].filter(Boolean).join(", ");

  return [line1, locality, postalCode]
    .filter(Boolean)
    .join(" · ");
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
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaRefreshVersion, setMediaRefreshVersion] =
    useState(0);
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [noteMessage, setNoteMessage] =
    useState<string | null>(null);

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
          <span className="site-mode-badge">
            <span className="site-mode-dot" />
            Field Mode
          </span>

          <div className="site-mode-current-job">
            <strong>
              {activeJob
                ? activeJob.title
                : status === "loading"
                  ? "Loading job…"
                  : "No active job"}
            </strong>

            <span>
              {activeJob
                ? address || activeJob.clientName
                : "Choose a job to begin"}
            </span>
          </div>
        </div>

        <div className="site-mode-ticks" />
      </header>

      <section
        className="site-mode-grid"
        aria-label="Site tools"
      >
        <button
          className="site-mode-tile"
          type="button"
          disabled={!activeJobIsWritable}
          onClick={openCamera}
        >
          <Camera aria-hidden="true" strokeWidth={1.4} />
          <span>Camera</span>
        </button>

        <button
          className="site-mode-tile"
          type="button"
          disabled={!activeJobIsWritable}
          onClick={openNotes}
        >
          <NotebookPen aria-hidden="true" strokeWidth={1.4} />
          <span>Notes</span>
        </button>

        <button
          className="site-mode-tile"
          type="button"
          disabled={!activeJob}
          onClick={() => setMediaOpen(true)}
        >
          <ClipboardList aria-hidden="true" strokeWidth={1.4} />
          <span>Job</span>
        </button>

        <button
          className="site-mode-tile"
          type="button"
          disabled={!activeJobIsWritable}
          onClick={() => navigate("/app/nailed-it")}
        >
          <Calculator aria-hidden="true" strokeWidth={1.4} />
          <span>Nailed-It</span>
        </button>
      </section>

      <button className="site-mode-exit" type="button" onClick={() => navigate("/app/today")}>
        <LogOut aria-hidden="true" strokeWidth={1.4} />
        <span>Exit Field Mode</span>
      </button>

      <input
        ref={photoInputRef}
        accept="image/*"
        capture="environment"
        className="site-mode-file-input"
        type="file"
        onChange={handlePhotoSelected}
      />

      {mediaOpen && activeJob ? (
        <>
          <button
            className="site-mode-scrim"
            type="button"
            aria-label="Close job media"
            onClick={() => setMediaOpen(false)}
          />

          <section
            className="site-mode-sheet site-mode-media-sheet"
            aria-label="Job media"
          >
            <div className="site-mode-sheet-handle" />

            <header className="site-mode-sheet-header">
              <div>
                <h2>Job Media</h2>
                <p>{activeJob.title}</p>
              </div>

              <button
                className="site-mode-sheet-close"
                type="button"
                aria-label="Close job media"
                onClick={() => setMediaOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>

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
