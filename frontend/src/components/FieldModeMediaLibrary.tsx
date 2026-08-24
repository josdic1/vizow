import type { Media } from "@vizow/shared";
import { useEffect, useMemo, useState } from "react";

import { fetchJobPhotos } from "../api/jobs";

type Props = {
  jobId: string;
  refreshKey: number;
};

type State =
  | { status: "loading" }
  | { status: "ready"; media: Media[] }
  | { status: "error"; message: string };

const stages: Media["stage"][] = [
  "before",
  "during",
  "after",
];
const emptyMedia: Media[] = [];

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayMediaUrl(value: string): string {
  try {
    const parsed = new URL(value);

    if (parsed.pathname.startsWith("/sample-projects/")) {
      return parsed.pathname;
    }
  } catch {
    // Keep the API value when it is not an absolute URL.
  }

  return value;
}

export function FieldModeMediaLibrary({
  jobId,
  refreshKey,
}: Props) {
  const [state, setState] = useState<State>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

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
              : "Unable to load photos.",
        });
      });

    return () => controller.abort();
  }, [jobId, refreshKey]);

  const media =
    state.status === "ready" ? state.media : emptyMedia;

  const groups = useMemo(
    () =>
      stages.map((stage) => ({
        stage,
        items: media.filter(
          (item) => item.stage === stage,
        ),
      })),
    [media],
  );

  if (state.status === "loading") {
    return (
      <p className="site-mode-media-message">
        Loading photos…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p className="site-mode-media-message site-mode-media-error">
        {state.message}
      </p>
    );
  }

  if (media.length === 0) {
    return (
      <p className="site-mode-media-message">
        No photos yet.
      </p>
    );
  }

  return (
    <div className="site-mode-media">
      {groups.map(({ stage, items }) =>
        items.length > 0 ? (
          <section
            className="site-mode-media-stage"
            key={stage}
          >
            <header>
              <strong>{label(stage)}</strong>
              <span>{items.length}</span>
            </header>

            <div className="site-mode-media-grid">
              {items.map((item) => (
                <figure key={item.id}>
                  <img
                    src={displayMediaUrl(item.url)}
                    alt={
                      item.caption ??
                      `${label(stage)} job photo`
                    }
                  />

                  {item.caption ? (
                    <figcaption>
                      {item.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}
