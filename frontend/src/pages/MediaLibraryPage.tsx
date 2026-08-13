import type {
  MediaLibraryItem,
  MediaStage,
} from "@vizow/shared";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MessageSquareText,
  Printer,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { fetchMediaLibrary } from "../api/media";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AppLayout } from "../layouts/AppLayout";
import "../styles/media-library.css";

type MediaState =
  | { status: "loading" }
  | { status: "ready"; media: MediaLibraryItem[] }
  | { status: "error"; message: string };

type StageFilter = "all" | MediaStage;
type SortOrder = "newest" | "oldest";
type MediaOutputMode =
  | "social"
  | "marketing-email"
  | "customer-update"
  | "customer-request"
  | "marketing"
  | "one-sheet"
  | "work-sample"
  | "invoice";

const mediaOutputOptions: Array<{
  mode: MediaOutputMode;
  label: string;
  singleJob?: boolean;
}> = [
  { mode: "social", label: "Social Post" },
  { mode: "marketing-email", label: "Marketing Email" },
  { mode: "customer-update", label: "Customer Update", singleJob: true },
  { mode: "customer-request", label: "Customer Request", singleJob: true },
  { mode: "marketing", label: "Marketing PDF" },
  { mode: "one-sheet", label: "One Sheet" },
  { mode: "work-sample", label: "Work Sample" },
  { mode: "invoice", label: "Invoice", singleJob: true },
];

function formatStage(stage: MediaStage): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function formatDate(value: string | null): string {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatAddress(item: MediaLibraryItem): string {
  const street = [item.serviceAddressLine1, item.serviceAddressLine2]
    .filter(Boolean)
    .join(", ");
  const locality = [item.serviceCity, item.serviceState, item.servicePostalCode]
    .filter(Boolean)
    .join(" ");
  return [street, locality].filter(Boolean).join(", ") || "No service address";
}

function formatPublicLocation(item: MediaLibraryItem): string {
  return [item.serviceCity, item.serviceState].filter(Boolean).join(", ") || "Project location";
}

function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] || value;
}

function outputLabel(mode: MediaOutputMode): string {
  return mediaOutputOptions.find((option) => option.mode === mode)?.label ?? "Output";
}

function selectedStageSummary(media: MediaLibraryItem[]): string {
  const stages = (["before", "during", "after"] as const).filter((stage) =>
    media.some((item) => item.stage === stage),
  );
  return stages.map(formatStage).join(" · ") || "Project media";
}

function selectedProjectNames(media: MediaLibraryItem[]): string[] {
  return [...new Set(media.map((item) => item.jobTitle))];
}

function sentence(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function socialCaption(media: MediaLibraryItem[]): string {
  const first = media[0];
  if (!first) return "";

  const jobs = selectedProjectNames(media);
  if (jobs.length > 1) {
    const cities = [...new Set(media.map(formatPublicLocation).filter(Boolean))];
    const location = cities.length === 1 ? ` in ${cities[0]}` : "";
    return `Recent project work${location}.\n\n${media.length} selected photos across ${jobs.length} Jobs.`;
  }

  const captions = [...new Set(
    media
      .map((item) => item.caption?.trim())
      .filter((value): value is string => Boolean(value)),
  )];
  const details = captions.slice(0, 2).map(sentence).join(" ");
  const intro = `${first.jobTitle} in ${formatPublicLocation(first)}.`;

  return details ? `${intro}\n\n${details}` : intro;
}

function hashtagToken(value: string): string {
  return value
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function socialHashtags(media: MediaLibraryItem[]): string {
  const tags: string[] = [];
  const push = (value: string) => {
    const token = hashtagToken(value);
    if (!token) return;
    const tag = `#${token}`;
    if (!tags.includes(tag)) tags.push(tag);
  };

  const jobTitles = [...new Set(media.map((item) => item.jobTitle))];
  for (const title of jobTitles.slice(0, 3)) push(title);

  const titleText = jobTitles.join(" ").toLowerCase();
  const related: Array<[RegExp, string]> = [
    [/door/, "Door Repair"],
    [/roof|leak/, "Roof Repair"],
    [/ceiling/, "Ceiling Repair"],
    [/drywall/, "Drywall Repair"],
    [/outlet|electrical/, "Electrical Repair"],
    [/sump|pump/, "Sump Pump"],
    [/deck|stair/, "Deck Repair"],
    [/cabinet/, "Cabinet Repair"],
    [/trim|exterior/, "Exterior Repair"],
    [/fan|vent/, "Ventilation"],
    [/kitchen/, "Kitchen Repair"],
    [/bathroom/, "Bathroom Repair"],
  ];
  for (const [pattern, label] of related) {
    if (pattern.test(titleText)) push(label);
  }

  const locations = [...new Set(
    media
      .map((item) => [item.serviceCity, item.serviceState].filter(Boolean).join(" "))
      .filter(Boolean),
  )];
  if (locations.length === 1) push(locations[0]);

  const stages = new Set(media.map((item) => item.stage));
  if (stages.has("before") && stages.has("after")) push("Before And After");

  push("Home Repair");
  push("Property Maintenance");

  return tags.slice(0, 8).join(" ");
}

function socialAssetTitle(media: MediaLibraryItem[]): { title: string; detail: string } {
  const jobs = selectedProjectNames(media);
  if (jobs.length === 1) {
    return { title: media[0].jobTitle, detail: formatPublicLocation(media[0]) };
  }
  return { title: "Recent Project Work", detail: `${jobs.length} Jobs · ${media.length} photos` };
}

function socialRects(count: number, width: number, height: number, gap: number): Array<{ x: number; y: number; width: number; height: number }> {
  if (count <= 1) return [{ x: 0, y: 0, width, height }];
  if (count === 2) {
    const cellWidth = (width - gap) / 2;
    return [
      { x: 0, y: 0, width: cellWidth, height },
      { x: cellWidth + gap, y: 0, width: cellWidth, height },
    ];
  }
  if (count === 3) {
    const leftWidth = Math.round(width * 0.58);
    const rightWidth = width - leftWidth - gap;
    const rightHeight = (height - gap) / 2;
    return [
      { x: 0, y: 0, width: leftWidth, height },
      { x: leftWidth + gap, y: 0, width: rightWidth, height: rightHeight },
      { x: leftWidth + gap, y: rightHeight + gap, width: rightWidth, height: rightHeight },
    ];
  }

  const cellWidth = (width - gap) / 2;
  const cellHeight = (height - gap) / 2;
  return [
    { x: 0, y: 0, width: cellWidth, height: cellHeight },
    { x: cellWidth + gap, y: 0, width: cellWidth, height: cellHeight },
    { x: 0, y: cellHeight + gap, width: cellWidth, height: cellHeight },
    { x: cellWidth + gap, y: cellHeight + gap, width: cellWidth, height: cellHeight },
  ];
}

async function loadSocialImage(url: string): Promise<ImageBitmap> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load one of the selected photos.");
  return createImageBitmap(await response.blob());
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const scale = Math.max(rect.width / image.width, rect.height / image.height);
  const sourceWidth = rect.width / scale;
  const sourceHeight = rect.height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, rect.x, rect.y, rect.width, rect.height);
}

function fitCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startingSize: number,
  minimumSize: number,
  weight: number,
): number {
  let size = startingSize;
  while (size > minimumSize) {
    context.font = `${weight} ${size}px Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

async function createSocialPostBlob(media: MediaLibraryItem[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the post image.");

  const paper = "#f3ecd9";
  const ink = "#2a1b14";
  const orange = "#f36c21";
  const muted = "#c8bea8";
  context.fillStyle = paper;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const selected = media.slice(0, 4);
  const margin = 48;
  const gridGap = 16;
  const footerGap = 24;
  const footerHeight = 176;
  const mediaWidth = canvas.width - margin * 2;
  const mediaHeight = canvas.height - margin * 2 - footerHeight - footerGap;
  const rects = socialRects(selected.length, mediaWidth, mediaHeight, gridGap);
  const images = await Promise.all(selected.map((item) => loadSocialImage(item.url)));

  try {
    context.save();
    context.translate(margin, margin);
    for (let index = 0; index < images.length; index += 1) {
      const rect = rects[index];
      drawCover(context, images[index], rect);

      context.strokeStyle = ink;
      context.lineWidth = 4;
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);

      const label = formatStage(selected[index].stage).toUpperCase();
      context.font = "900 22px Arial, sans-serif";
      const labelWidth = context.measureText(label).width + 30;
      context.fillStyle = selected[index].stage === "after" ? orange : selected[index].stage === "during" ? "#e5c66f" : paper;
      context.fillRect(rect.x + 16, rect.y + rect.height - 48, labelWidth, 34);
      context.strokeStyle = ink;
      context.lineWidth = 2;
      context.strokeRect(rect.x + 16, rect.y + rect.height - 48, labelWidth, 34);
      context.fillStyle = ink;
      context.fillText(label, rect.x + 31, rect.y + rect.height - 23);
    }

    if (media.length > 4) {
      const last = rects[3];
      context.fillStyle = "rgba(42,27,20,.72)";
      context.fillRect(last.x, last.y, last.width, last.height);
      context.fillStyle = paper;
      context.font = "900 64px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(`+${media.length - 4}`, last.x + last.width / 2, last.y + last.height / 2);
      context.textAlign = "start";
      context.textBaseline = "alphabetic";
    }
    context.restore();
  } finally {
    images.forEach((image) => image.close());
  }

  const footerY = margin + mediaHeight + footerGap;
  context.fillStyle = ink;
  context.fillRect(margin, footerY, mediaWidth, footerHeight);
  context.fillStyle = orange;
  context.fillRect(margin, footerY, 12, footerHeight);

  const asset = socialAssetTitle(media);
  const title = asset.title.toUpperCase();
  const titleSize = fitCanvasText(context, title, mediaWidth - 88, 50, 30, 900);
  context.fillStyle = paper;
  context.font = `900 ${titleSize}px Arial, sans-serif`;
  context.fillText(title, margin + 42, footerY + 68);

  context.fillStyle = muted;
  context.font = "800 26px Arial, sans-serif";
  context.fillText(asset.detail.toUpperCase(), margin + 42, footerY + 112);

  context.fillStyle = orange;
  context.font = "900 20px Arial, sans-serif";
  context.fillText(selectedStageSummary(media).toUpperCase(), margin + 42, footerY + 146);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The post image could not be exported."));
    }, "image/png");
  });
}

function socialFilename(media: MediaLibraryItem[]): string {
  const base = selectedProjectNames(media).length === 1 ? media[0].jobTitle : "recent-project-work";
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "social-post";
  return `${slug}-social-post.png`;
}

function generatedCopy(
  mode: MediaOutputMode,
  media: MediaLibraryItem[],
): { subject?: string; body: string } {
  const first = media[0];
  const jobs = selectedProjectNames(media);
  const photoLabel = `${media.length} selected photo${media.length === 1 ? "" : "s"}`;
  const stageLabel = selectedStageSummary(media);

  if (!first) return { body: "" };

  if (mode === "social") {
    return { body: socialCaption(media) };
  }

  if (mode === "marketing-email") {
    return {
      subject: jobs.length === 1
        ? `Recent project: ${first.jobTitle}`
        : `Recent project work`,
      body: jobs.length === 1
        ? `We recently documented ${first.jobTitle.toLowerCase()} in ${formatPublicLocation(first)}.\n\nThe selected photos show ${stageLabel.toLowerCase()} work from the project.\n\nReply if you would like us to take a look at something similar.`
        : `Here are a few examples from recent work.\n\nThis selection includes ${media.length} photos across ${jobs.length} projects.\n\nReply if you would like us to take a look at something similar.`,
    };
  }

  if (mode === "customer-update") {
    return {
      subject: `Update: ${first.jobTitle}`,
      body: `Hi ${firstName(first.clientName)},\n\nHere’s a visual update on ${first.jobTitle} at ${formatAddress(first)}.\n\nI’ve included ${photoLabel} showing ${stageLabel.toLowerCase()} work.\n\nLet me know if you have any questions.`,
    };
  }

  if (mode === "customer-request") {
    return {
      subject: `Action needed: ${first.jobTitle}`,
      body: `Hi ${firstName(first.clientName)},\n\nI’ve included ${photoLabel} from ${first.jobTitle}. Please review the documented work and let me know how you’d like to proceed.\n\nThanks.`,
    };
  }

  return { body: "" };
}

export function MediaLibraryPage() {
  const [state, setState] = useState<MediaState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [clientId, setClientId] = useState("all");
  const [jobId, setJobId] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [focused, setFocused] = useState<MediaLibraryItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchMediaLibrary(controller.signal)
      .then((media) => setState({ status: "ready", media }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to load Media Library.",
        });
      });

    return () => controller.abort();
  }, []);

  const media = state.status === "ready" ? state.media : [];

  const clients = useMemo(() => {
    const values = new Map<string, string>();
    for (const item of media) values.set(item.clientId, item.clientName);
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [media]);

  const jobs = useMemo(() => {
    const values = new Map<string, { title: string; clientId: string }>();
    for (const item of media) values.set(item.jobId, { title: item.jobTitle, clientId: item.clientId });
    return [...values.entries()]
      .filter(([, value]) => clientId === "all" || value.clientId === clientId)
      .sort((a, b) => a[1].title.localeCompare(b[1].title));
  }, [media, clientId]);

  useEffect(() => {
    if (jobId === "all") return;
    if (!jobs.some(([id]) => id === jobId)) setJobId("all");
  }, [jobId, jobs]);

  const visibleMedia = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = media.filter((item) => {
      if (stage !== "all" && item.stage !== stage) return false;
      if (clientId !== "all" && item.clientId !== clientId) return false;
      if (jobId !== "all" && item.jobId !== jobId) return false;
      if (!query) return true;
      return [
        item.clientName,
        item.jobTitle,
        item.caption,
        item.attachedNote,
        formatAddress(item),
        `cycle ${item.cycleNumber}`,
        item.stage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return [...filtered].sort((a, b) => {
      const first = new Date(a.capturedAt ?? a.createdAt).getTime();
      const second = new Date(b.capturedAt ?? b.createdAt).getTime();
      return sortOrder === "newest" ? second - first : first - second;
    });
  }, [media, search, stage, clientId, jobId, sortOrder]);

  const stageCounts = useMemo(
    () => ({
      all: media.length,
      before: media.filter((item) => item.stage === "before").length,
      during: media.filter((item) => item.stage === "during").length,
      after: media.filter((item) => item.stage === "after").length,
    }),
    [media],
  );

  const selectedMedia = useMemo(() => {
    const selected = new Set(selectedIds);
    return media.filter((item) => selected.has(item.id));
  }, [media, selectedIds]);

  function toggleSelected(id: string): void {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function clearSelection(): void {
    setSelectedIds([]);
    setCreateOpen(false);
  }

  return (
    <AppLayout
      object="Contractor Media"
      tool="Media Library"
      action="Select and create"
      result={state.status === "ready" ? `${media.length} photos` : state.status === "error" ? "Not loaded" : "Loading"}
      message="Search the Job media already in Vizow. Select any useful photos, then create something from that selection."
      activeStep="action"
      resultTone={state.status === "error" ? "error" : "success"}
      sections={[
        { id: "media-filters", label: "Filters" },
        { id: "media-library", label: "Media" },
      ]}
    >
      <div className="page">
        <div className="admin-page media-library-page">
          <AdminPageHeader
            eyebrow="Media"
            title="Media Library"
            description="Search, inspect, or select Job photos. Selected media can become a post, email, work sample, PDF, customer message, or invoice entry point."
            meta={<span>{media.length} photos</span>}
          />

          <section className="media-library-controls" id="media-filters" aria-label="Media filters">
            <div className="media-library-search-row">
              <label className="admin-search-field media-library-search">
                <span className="sr-only">Search Media Library</span>
                <input
                  placeholder="Search photos…"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                />
              </label>

              <select value={clientId} onChange={(event) => setClientId(event.currentTarget.value)} aria-label="Filter by client">
                <option value="all">All clients</option>
                {clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>

              <select value={jobId} onChange={(event) => setJobId(event.currentTarget.value)} aria-label="Filter by Job">
                <option value="all">All Jobs</option>
                {jobs.map(([id, value]) => <option key={id} value={id}>{value.title}</option>)}
              </select>

              <select value={sortOrder} onChange={(event) => setSortOrder(event.currentTarget.value as SortOrder)} aria-label="Sort media">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>

            <div className="media-stage-picks" role="group" aria-label="Photo stage">
              {(["all", "before", "during", "after"] as const).map((value) => (
                <button
                  className={stage === value ? "is-active" : ""}
                  key={value}
                  type="button"
                  onClick={() => setStage(value)}
                >
                  <span>{value === "all" ? "All" : formatStage(value)}</span>
                  <strong>{stageCounts[value]}</strong>
                </button>
              ))}
            </div>
          </section>

          {state.status === "loading" && <div className="notice">Loading Media Library…</div>}
          {state.status === "error" && <div className="notice notice-error" role="alert">{state.message}</div>}

          {state.status === "ready" && visibleMedia.length === 0 && (
            <div className="admin-empty-state admin-empty-state-large" id="media-library">
              <strong>No photos match this view.</strong>
              <span>Clear a filter or add photos to a Job.</span>
            </div>
          )}

          {visibleMedia.length > 0 && (
            <section className="media-library-grid" id="media-library" aria-label="Media Library results">
              {visibleMedia.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <article className={`media-library-card${isSelected ? " is-selected" : ""}`} key={item.id}>
                    <button
                      className="media-library-card-open"
                      type="button"
                      onClick={() => setFocused(item)}
                      aria-label={`Open ${item.jobTitle} photo details`}
                    >
                      <div className="media-library-photo-button">
                        <img src={item.url} alt={item.caption ?? `${formatStage(item.stage)} photo from ${item.jobTitle}`} />
                        <span className={`media-stage-tag media-stage-${item.stage}`}>{formatStage(item.stage)}</span>
                      </div>

                      <div className="media-library-card-body">
                        <div>
                          <p className="eyebrow">{item.clientName}</p>
                          <h2>{item.jobTitle}</h2>
                        </div>
                      </div>

                      <div className="media-library-card-meta">
                        <span>Cycle {item.cycleNumber}</span>
                        <span>{formatDate(item.capturedAt ?? item.createdAt)}</span>
                      </div>
                      {item.caption && <p className="media-library-caption">{item.caption}</p>}
                    </button>

                    <button
                      className="media-library-select-toggle"
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={isSelected ? "Remove photo from selection" : "Select photo"}
                      onClick={() => toggleSelected(item.id)}
                    >
                      {isSelected && <Check aria-hidden="true" />}
                    </button>
                  </article>
                );
              })}
            </section>
          )}

          {selectedMedia.length > 0 && (
            <div className="media-selection-bar" role="region" aria-label="Selected media actions">
              <strong>{selectedMedia.length} selected</strong>
              <div>
                <button className="btn btn-primary" type="button" onClick={() => setCreateOpen(true)}>Create from Selected</button>
                <button className="btn" type="button" onClick={clearSelection}>Clear</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {focused && (
        <div className="media-detail-backdrop" role="presentation" onMouseDown={() => setFocused(null)}>
          <section className="media-detail-panel" role="dialog" aria-modal="true" aria-label="Photo details" onMouseDown={(event) => event.stopPropagation()}>
            <button className="media-detail-close" type="button" onClick={() => setFocused(null)} aria-label="Close photo details"><X aria-hidden="true" /></button>
            <div className="media-detail-image"><img src={focused.url} alt={focused.caption ?? `${formatStage(focused.stage)} photo`} /></div>
            <div className="media-detail-copy">
              <div className="media-detail-heading">
                <div>
                  <p className="eyebrow">{focused.clientName}</p>
                  <h2>{focused.jobTitle}</h2>
                </div>
                <span className={`media-stage-tag media-stage-${focused.stage}`}>{formatStage(focused.stage)}</span>
              </div>
              <dl className="media-detail-facts">
                <div><dt>Cycle</dt><dd>{focused.cycleNumber}</dd></div>
                <div><dt>Date</dt><dd>{formatDate(focused.capturedAt ?? focused.createdAt)}</dd></div>
                <div><dt>Property</dt><dd>{formatAddress(focused)}</dd></div>
              </dl>
              {focused.caption && <div className="media-detail-note"><strong>Caption</strong><p>{focused.caption}</p></div>}
              {focused.attachedNote && <div className="media-detail-note"><strong>Attached note</strong><p>{focused.attachedNote}</p></div>}

              <div className="media-detail-actions">
                <Link className="btn btn-secondary" to={`/jobs/${focused.jobId}`}><ExternalLink aria-hidden="true" /> Open Job</Link>
                <Link className="btn btn-primary" to={`/jobs/${focused.jobId}/vow`}><ExternalLink aria-hidden="true" /> Open VOW</Link>
              </div>
            </div>
          </section>
        </div>
      )}

      {createOpen && selectedMedia.length > 0 && (
        <MediaCreateDialog media={selectedMedia} onClose={() => setCreateOpen(false)} />
      )}
    </AppLayout>
  );
}

function MediaCreateDialog({
  media,
  onClose,
}: {
  media: MediaLibraryItem[];
  onClose: () => void;
}) {
  const jobIds = [...new Set(media.map((item) => item.jobId))];
  const singleJob = jobIds.length === 1 ? media[0] : null;
  const [mode, setMode] = useState<MediaOutputMode>("social");
  const generated = useMemo(() => generatedCopy(mode, media), [mode, media]);
  const [subject, setSubject] = useState(generated.subject ?? "");
  const [body, setBody] = useState(generated.body);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const next = generatedCopy(mode, media);
    setSubject(next.subject ?? "");
    setBody(next.body);
  }, [mode, media]);

  const isTextMode = (["marketing-email", "customer-update", "customer-request"] as MediaOutputMode[]).includes(mode);

  async function copyDraft(): Promise<void> {
    const value = subject.trim() ? `Subject: ${subject.trim()}\n\n${body}` : body;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="media-create-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="media-create-panel" role="dialog" aria-modal="true" aria-label="Create from selected media" onMouseDown={(event) => event.stopPropagation()}>
        <header className="media-create-header no-print">
          <div>
            <p className="eyebrow">Create from selected media</p>
            <h2>{media.length} photo{media.length === 1 ? "" : "s"} selected</h2>
            <p>{jobIds.length === 1 ? media[0].jobTitle : `${jobIds.length} Jobs selected`}</p>
          </div>
          <button type="button" className="media-detail-close" onClick={onClose} aria-label="Close create panel"><X aria-hidden="true" /></button>
        </header>

        <div className="media-create-options no-print" role="group" aria-label="Output type">
          {mediaOutputOptions.map((option) => {
            const disabled = Boolean(option.singleJob && !singleJob);
            return (
              <button
                key={option.mode}
                className={mode === option.mode ? "is-active" : ""}
                type="button"
                disabled={disabled}
                title={disabled ? "Select photos from one Job for this output." : undefined}
                onClick={() => setMode(option.mode)}
              >
                {option.label}
                {disabled && <small>One Job</small>}
              </button>
            );
          })}
        </div>

        <div className="media-create-workspace">
          {mode === "social" ? (
            <MediaSocialOutput media={media} />
          ) : isTextMode ? (
            <MediaTextOutput
              mode={mode}
              subject={subject}
              body={body}
              setSubject={setSubject}
              setBody={setBody}
              media={media}
            />
          ) : mode === "invoice" && singleJob ? (
            <MediaInvoiceOutput media={media} job={singleJob} />
          ) : mode === "marketing" || mode === "one-sheet" || mode === "work-sample" ? (
            <MediaVisualOutput mode={mode} media={media} />
          ) : null}
        </div>

        <footer className="media-create-actions no-print">
          {mode === "social" ? null : isTextMode ? (
            <button className="btn btn-primary" type="button" onClick={copyDraft}>
              <Copy aria-hidden="true" /> {copied ? "Copied" : "Copy Draft"}
            </button>
          ) : mode === "invoice" && singleJob ? (
            <Link className="btn btn-primary" to={`/jobs/${singleJob.jobId}/vow`}>
              <ExternalLink aria-hidden="true" /> Open Job VOW for Invoice
            </Link>
          ) : (
            <button className="btn btn-primary" type="button" onClick={() => window.print()}>
              <Printer aria-hidden="true" /> Print / Save PDF
            </button>
          )}
          <button className="btn" type="button" onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  );
}

function MediaSocialOutput({ media }: { media: MediaLibraryItem[] }) {
  const [caption, setCaption] = useState(() => socialCaption(media));
  const [hashtags, setHashtags] = useState(() => socialHashtags(media));
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setCaption(socialCaption(media));
    setHashtags(socialHashtags(media));
    setCopied(false);
    setDownloadError(null);
  }, [media]);

  async function copyCaption(): Promise<void> {
    const value = [caption.trim(), hashtags.trim()].filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function downloadPost(): Promise<void> {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await createSocialPostBlob(media);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = socialFilename(media);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Unable to download the post image.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <article className="media-social-output">
      <div className="media-create-copy-heading media-social-heading">
        <div className="media-create-copy-icon"><Share2 aria-hidden="true" /></div>
        <div>
          <p className="eyebrow">Social Post</p>
          <h3>Ready to post</h3>
          <p>Vizow composes the selected evidence into a 1080 × 1350 image and drafts the caption from the Job data.</p>
        </div>
      </div>

      <div className="media-social-workspace">
        <SocialPostPreview media={media} />

        <div className="media-social-copy">
          <label className="media-create-field">
            <span>Caption</span>
            <textarea rows={7} value={caption} onChange={(event) => setCaption(event.currentTarget.value)} />
          </label>

          <label className="media-create-field">
            <span>Hashtags</span>
            <textarea className="media-social-hashtags" rows={3} value={hashtags} onChange={(event) => setHashtags(event.currentTarget.value)} />
          </label>

          <div className="media-social-actions">
            <button className="btn btn-primary" type="button" onClick={downloadPost} disabled={downloading}>
              <Download aria-hidden="true" /> {downloading ? "Building Post…" : "Download Post"}
            </button>
            <button className="btn" type="button" onClick={copyCaption}>
              <Copy aria-hidden="true" /> {copied ? "Copied" : "Copy Caption"}
            </button>
          </div>

          {downloadError && <p className="media-social-error" role="alert">{downloadError}</p>}
          {media.length > 4 && <p className="media-social-note">The post image uses the first four selected photos; all selected media remains available for other outputs.</p>}
        </div>
      </div>
    </article>
  );
}

function SocialPostPreview({ media }: { media: MediaLibraryItem[] }) {
  const shown = media.slice(0, 4);
  const asset = socialAssetTitle(media);

  return (
    <div className="media-social-preview" aria-label="Social post preview">
      <div className={`media-social-preview-grid media-social-preview-count-${shown.length}`}>
        {shown.map((item, index) => (
          <figure key={item.id}>
            <img src={item.url} alt={item.caption ?? `${formatStage(item.stage)} photo`} />
            <figcaption className={`media-stage-${item.stage}`}>{formatStage(item.stage)}</figcaption>
            {index === 3 && media.length > 4 && <span className="media-social-more">+{media.length - 4}</span>}
          </figure>
        ))}
      </div>
      <div className="media-social-preview-footer">
        <strong>{asset.title}</strong>
        <span>{asset.detail}</span>
        <small>{selectedStageSummary(media)}</small>
      </div>
    </div>
  );
}

function MediaTextOutput({
  mode,
  subject,
  body,
  setSubject,
  setBody,
  media,
}: {
  mode: MediaOutputMode;
  subject: string;
  body: string;
  setSubject: (value: string) => void;
  setBody: (value: string) => void;
  media: MediaLibraryItem[];
}) {
  const Icon = mode === "marketing-email" ? Mail : MessageSquareText;

  return (
    <article className="media-create-copy-output">
      <div className="media-create-copy-heading">
        <div className="media-create-copy-icon"><Icon aria-hidden="true" /></div>
        <div>
          <p className="eyebrow">{outputLabel(mode)}</p>
          <h3>{outputLabel(mode)}</h3>
          <p>Drafted from the selected media. Edit freely; the Job records stay unchanged.</p>
        </div>
      </div>

      <SelectedMediaStrip media={media.slice(0, 5)} />

      {mode !== "social" && (
        <label className="media-create-field">
          <span>Subject</span>
          <input value={subject} onChange={(event) => setSubject(event.currentTarget.value)} />
        </label>
      )}
      <label className="media-create-field">
        <span>{mode === "social" ? "Post copy" : "Message"}</span>
        <textarea rows={9} value={body} onChange={(event) => setBody(event.currentTarget.value)} />
      </label>
    </article>
  );
}

function SelectedMediaStrip({ media }: { media: MediaLibraryItem[] }) {
  return (
    <div className="media-create-strip" aria-label="Selected photos">
      {media.map((item) => (
        <figure key={item.id}>
          <img src={item.url} alt={item.caption ?? `${formatStage(item.stage)} photo`} />
          <figcaption>{formatStage(item.stage)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function MediaVisualOutput({
  mode,
  media,
}: {
  mode: "marketing" | "one-sheet" | "work-sample";
  media: MediaLibraryItem[];
}) {
  const jobs = selectedProjectNames(media);
  const first = media[0];
  const title = mode === "marketing"
    ? "Selected Project Work"
    : mode === "one-sheet"
      ? "Project One Sheet"
      : "Work Sample";

  return (
    <article className={`media-create-printable media-create-${mode}`}>
      <header className="media-create-document-head">
        <div>
          <p className="eyebrow">Vizow · {outputLabel(mode)}</p>
          <h2>{jobs.length === 1 ? first.jobTitle : title}</h2>
          <p>{jobs.length === 1 ? formatPublicLocation(first) : `${jobs.length} selected projects`}</p>
        </div>
        <strong>{media.length} photos</strong>
      </header>

      <div className="media-create-document-grid">
        {media.map((item) => (
          <figure key={item.id}>
            <img src={item.url} alt={item.caption ?? `${formatStage(item.stage)} photo`} />
            <figcaption>
              <strong>{formatStage(item.stage)}</strong>
              <span>{item.jobTitle}</span>
              {mode !== "work-sample" && <small>{item.clientName}</small>}
            </figcaption>
          </figure>
        ))}
      </div>
    </article>
  );
}

function MediaInvoiceOutput({
  media,
  job,
}: {
  media: MediaLibraryItem[];
  job: MediaLibraryItem;
}) {
  return (
    <article className="media-create-printable media-create-invoice-entry">
      <div className="media-create-invoice-icon"><FileText aria-hidden="true" /></div>
      <p className="eyebrow">Invoice</p>
      <h2>{job.jobTitle}</h2>
      <p>{job.clientName} · {formatAddress(job)}</p>
      <p className="media-create-invoice-note">
        Selected photos can support the invoice, but billing amounts come from the Job/VOW. Vizow does not invent financial data from media.
      </p>
      <SelectedMediaStrip media={media.slice(0, 6)} />
    </article>
  );
}
