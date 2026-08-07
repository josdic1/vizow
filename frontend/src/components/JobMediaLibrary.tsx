import type { Media } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";

import { fetchJobPhotos } from "../api/jobs";

type JobMediaLibraryProps = {
  jobId: string;
  refreshKey: number;
};

type MediaState =
  | { status: "loading" }
  | { status: "ready"; media: Media[] }
  | { status: "error"; message: string };

const stages: Media["stage"][] = [
  "before",
  "during",
  "after",
];

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function JobMediaLibrary({
  jobId,
  refreshKey,
}: JobMediaLibraryProps) {
  const [state, setState] = useState<MediaState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    setState({ status: "loading" });

    fetchJobPhotos(jobId, controller.signal)
      .then((media) => {
        setState({ status: "ready", media });
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load Job photos.",
        });
      });

    return () => controller.abort();
  }, [jobId, refreshKey]);

  const media =
    state.status === "ready" ? state.media : [];

  const groupedMedia = useMemo(
    () =>
      stages.map((stage) => ({
        stage,
        media: media.filter(
          (item) => item.stage === stage,
        ),
      })),
    [media],
  );

  return (
    <section className="field-media-library">
      <div className="field-media-library-heading">
        <div>
          <p className="eyebrow">Media Library</p>
          <h2>Job Photos</h2>
        </div>

        <strong>{media.length}</strong>
      </div>

      {state.status === "loading" && (
        <div className="notice">Loading photos…</div>
      )}

      {state.status === "error" && (
        <div className="notice notice-error" role="alert">
          {state.message}
        </div>
      )}

      {state.status === "ready" && media.length === 0 && (
        <div className="field-media-empty">
          No photos have been saved to this Job yet.
        </div>
      )}

      {state.status === "ready" &&
        media.length > 0 &&
        groupedMedia.map(({ stage, media: items }) => {
          if (items.length === 0) {
            return null;
          }

          return (
            <div
              className="field-media-stage"
              key={stage}
            >
              <div className="field-media-stage-heading">
                <h3>{formatLabel(stage)}</h3>
                <span>{items.length}</span>
              </div>

              <div className="field-media-grid">
                {items.map((item) => (
                  <figure
                    className="field-media-card"
                    key={item.id}
                  >
                    <img
                      src={item.url}
                      alt={
                        item.caption ??
                        `${formatLabel(item.stage)} Job photo`
                      }
                    />

                    {item.caption && (
                      <figcaption>
                        {item.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          );
        })}
    </section>
  );
}
