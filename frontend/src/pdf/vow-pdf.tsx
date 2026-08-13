import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type {
  Job,
  JobJourneyEvent,
  Media,
  ScopeRevision,
  Visit,
} from "@vizow/shared";

export type PdfOutputMode =
  | "full"
  | "social"
  | "marketing-email"
  | "customer-update"
  | "customer-request"
  | "marketing"
  | "one-sheet"
  | "work-sample"
  | "invoice";

type VowPdfInput = {
  mode: PdfOutputMode;
  job: Job;
  events: JobJourneyEvent[];
  media: Media[];
  revisions: ScopeRevision[];
  visits: Visit[];
  cycleNumbers: number[];
  cycleMap: Map<string, number>;
  finalPrice: number | null;
  completionDate: string | null;
};

const C = {
  ink: "#271a13",
  orange: "#f06423",
  paper: "#f7f1e3",
  white: "#ffffff",
  muted: "#746b62",
  rule: "#d8d0c2",
  soft: "#eee7d8",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
    backgroundColor: C.white,
    paddingTop: 34,
    paddingRight: 38,
    paddingBottom: 40,
    paddingLeft: 38,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    paddingBottom: 10,
    marginBottom: 22,
  },
  brand: { fontSize: 12, fontWeight: 700, letterSpacing: 1.2 },
  brandSub: { color: C.orange, fontSize: 6.6, letterSpacing: 1.8, marginLeft: 7 },
  docKind: { color: C.muted, fontSize: 7, letterSpacing: 1.3, textTransform: "uppercase" },
  eyebrow: { color: C.orange, fontSize: 7, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 },
  title: { fontSize: 27, fontWeight: 700, lineHeight: 1.02, letterSpacing: -0.6 },
  location: { color: C.muted, fontSize: 9, marginTop: 6 },
  summary: { fontSize: 10, lineHeight: 1.45, marginTop: 14, maxWidth: 470 },
  heroMeta: { flexDirection: "row", marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.rule },
  metaCell: { flexGrow: 1, paddingVertical: 9, paddingRight: 14 },
  metaCellBorder: { borderLeftWidth: 1, borderLeftColor: C.rule, paddingLeft: 14 },
  metaLabel: { color: C.muted, fontSize: 6.5, letterSpacing: 1.1, textTransform: "uppercase" },
  metaValue: { fontSize: 10, fontWeight: 700, marginTop: 3 },
  section: { marginTop: 25 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 700 },
  sectionMeta: { color: C.muted, fontSize: 7 },
  compare: { flexDirection: "row", gap: 10 },
  compareCard: { width: "50%", borderWidth: 1, borderColor: C.rule, backgroundColor: C.paper },
  compareImage: { width: "100%", height: 205, objectFit: "cover" },
  imageEmpty: { height: 205, alignItems: "center", justifyContent: "center", color: C.muted },
  compareCaption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 8 },
  stage: { color: C.orange, fontSize: 7, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase" },
  caption: { color: C.muted, fontSize: 7, maxWidth: 190, textAlign: "right" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { width: "31.9%", borderWidth: 1, borderColor: C.rule, backgroundColor: C.paper, marginBottom: 3 },
  photoImage: { width: "100%", height: 105, objectFit: "cover" },
  photoMeta: { padding: 6 },
  photoCaption: { color: C.muted, fontSize: 6.8, lineHeight: 1.25, marginTop: 3 },
  storyBox: { backgroundColor: C.paper, padding: 16, marginTop: 20, borderLeftWidth: 3, borderLeftColor: C.orange },
  storyTitle: { fontSize: 11, fontWeight: 700 },
  storyText: { marginTop: 6, fontSize: 9, lineHeight: 1.45 },
  timelineItem: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.rule },
  timelineDate: { width: 108, color: C.muted, fontSize: 7 },
  timelineBody: { flexGrow: 1 },
  timelineTitle: { fontSize: 9, fontWeight: 700 },
  timelineText: { marginTop: 3, color: C.muted, lineHeight: 1.35 },
  badge: { alignSelf: "flex-start", backgroundColor: C.ink, color: C.white, paddingVertical: 5, paddingHorizontal: 8, fontSize: 7, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" },
  orangeBadge: { backgroundColor: C.orange, color: C.ink },
  oneSheetLayout: { flexDirection: "row", gap: 20, marginTop: 24 },
  oneSheetCopy: { width: "39%" },
  oneSheetVisual: { width: "61%" },
  factRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.rule },
  factLabel: { color: C.muted, fontSize: 6.5, letterSpacing: 1, textTransform: "uppercase" },
  factValue: { marginTop: 3, fontSize: 9, fontWeight: 700 },
  invoiceHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  invoiceParty: { width: "48%", backgroundColor: C.paper, padding: 14 },
  invoiceRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.rule, paddingVertical: 9 },
  invoiceDesc: { width: "74%" },
  invoiceAmount: { width: "26%", textAlign: "right", fontWeight: 700 },
  invoiceTotal: { flexDirection: "row", justifyContent: "flex-end", alignItems: "baseline", marginTop: 16 },
  invoiceTotalLabel: { fontSize: 9, fontWeight: 700, marginRight: 14 },
  invoiceTotalValue: { fontSize: 20, fontWeight: 700, color: C.orange },
  footer: { position: "absolute", left: 38, right: 38, bottom: 18, flexDirection: "row", justifyContent: "space-between", color: C.muted, fontSize: 6.5 },
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatMoney(value: number | null): string {
  if (value === null) return "Not recorded";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatAddress(job: Job, publicOnly = false): string {
  if (publicOnly) return [job.serviceCity, job.serviceState].filter(Boolean).join(", ") || "Project location";
  return [
    [job.serviceAddressLine1, job.serviceAddressLine2].filter(Boolean).join(", "),
    [job.serviceCity, job.serviceState, job.servicePostalCode].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ") || "No service address recorded";
}

function statusLabel(job: Job): string {
  if (job.archivedAt) return "Archived";
  if (job.lifecycleStatus === "cancelled") return "Cancelled";
  return job.currentCycle.stage === "completed" ? "Completed" : "Active";
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventTitle(event: JobJourneyEvent): string {
  const details = record(event.details);
  const stage = text(record(details?.photo)?.stage) ?? text(details?.stage);
  const names: Record<string, string> = {
    job_created: "Job created",
    cycle_reopened: "Cycle opened",
    cycle_closed: "Cycle completed",
    visit_scheduled: "Visit scheduled",
    visit_completed: "Visit completed",
    visit_cancelled: "Visit cancelled",
    field_note_created: "Field note",
    scope_revision_created: "Scope revision",
    scope_revision_visit_linked: "Scope change linked to visit",
    job_cancelled: "Job cancelled",
    job_archived: "Job archived",
  };
  if (event.eventType === "photo_uploaded") return `${stage ? stage[0].toUpperCase() + stage.slice(1) : "Job"} photo`;
  return names[event.eventType] ?? event.eventType.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase());
}

function eventBody(event: JobJourneyEvent): string | null {
  const details = record(event.details);
  return text(record(details?.fieldNote)?.content)
    ?? text(record(details?.scopeRevision)?.scopeText)
    ?? text(record(details?.visit)?.notes)
    ?? text(record(details?.photo)?.caption)
    ?? text(record(details?.closure)?.notes)
    ?? text(details?.message)
    ?? text(details?.reason)
    ?? text(details?.cancellationReason);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "job";
}

function BrandHeader({ kind }: { kind: string }) {
  return <View style={styles.brandRow} fixed>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text style={styles.brand}>VIZOW</Text><Text style={styles.brandSub}>VISUAL OF WORK</Text>
    </View>
    <Text style={styles.docKind}>{kind}</Text>
  </View>;
}

function Footer() {
  return <View style={styles.footer} fixed>
    <Text>Generated from Vizow</Text>
    <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>;
}

function Hero({ job, label, publicOnly = false }: { job: Job; label: string; publicOnly?: boolean }) {
  return <>
    <Text style={styles.eyebrow}>{label}</Text>
    <Text style={styles.title}>{job.title}</Text>
    <Text style={styles.location}>{formatAddress(job, publicOnly)}</Text>
  </>;
}

function MetaStrip({ input, publicOnly = false }: { input: VowPdfInput; publicOnly?: boolean }) {
  const items = [
    ["Status", statusLabel(input.job)],
    ["Cycles", String(input.cycleNumbers.length)],
    ["Photos", String(input.media.length)],
    [publicOnly ? "Location" : "Client", publicOnly ? formatAddress(input.job, true) : input.job.clientName],
  ];
  return <View style={styles.heroMeta}>
    {items.map(([label, value], index) => <View key={label} style={[styles.metaCell, index ? styles.metaCellBorder : {}]}>
      <Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{value}</Text>
    </View>)}
  </View>;
}

function pickBeforeAfter(media: Media[]): [Media | null, Media | null] {
  const sorted = [...media].sort((a, b) => new Date(a.capturedAt ?? a.createdAt).getTime() - new Date(b.capturedAt ?? b.createdAt).getTime());
  const before = sorted.find((m) => m.stage === "before") ?? sorted[0] ?? null;
  const after = [...sorted].reverse().find((m) => m.stage === "after") ?? sorted.at(-1) ?? null;
  return [before, after];
}

function BeforeAfter({ media }: { media: Media[] }) {
  const [before, after] = pickBeforeAfter(media);
  return <View style={styles.section} wrap={false}>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Before & After</Text><Text style={styles.sectionMeta}>Visual proof</Text></View>
    <View style={styles.compare}>
      {[before, after].map((item, index) => <View key={index} style={styles.compareCard}>
        {item ? <Image src={item.url} style={styles.compareImage} /> : <View style={styles.imageEmpty}><Text>No photo</Text></View>}
        <View style={styles.compareCaption}><Text style={styles.stage}>{index === 0 ? "Before" : "After"}</Text><Text style={styles.caption}>{item?.caption ?? ""}</Text></View>
      </View>)}
    </View>
  </View>;
}

function PhotoGrid({ media, limit }: { media: Media[]; limit?: number }) {
  const items = typeof limit === "number" ? media.slice(0, limit) : media;
  if (!items.length) return null;
  return <View style={styles.section}>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Photo Record</Text><Text style={styles.sectionMeta}>{items.length} shown</Text></View>
    <View style={styles.grid}>
      {items.map((item) => <View key={item.id} style={styles.photo} wrap={false}>
        <Image src={item.url} style={styles.photoImage} />
        <View style={styles.photoMeta}><Text style={styles.stage}>{item.stage}</Text><Text style={styles.photoCaption}>{item.caption ?? formatDate(item.capturedAt ?? item.createdAt)}</Text></View>
      </View>)}
    </View>
  </View>;
}

function WorkSample({ input }: { input: VowPdfInput }) {
  return <Document title={`${input.job.title} — Work Sample`} author="Vizow">
    <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Work Sample" />
      <Hero job={input.job} label="Selected project" publicOnly />
      <Text style={styles.summary}>{input.job.description?.trim() || "Documented project work and visual evidence."}</Text>
      <MetaStrip input={input} publicOnly />
      <BeforeAfter media={input.media} />
      <View style={styles.storyBox} wrap={false}>
        <Text style={styles.eyebrow}>Result</Text>
        <Text style={styles.storyTitle}>{input.job.title}</Text>
        <Text style={styles.storyText}>{input.job.description?.trim() || "The completed work is documented in the Visual of Work."}</Text>
      </View>
      <Footer />
    </Page>
    {input.media.length > 2 && <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Work Sample · Evidence" />
      <PhotoGrid media={input.media} limit={9} />
      <Footer />
    </Page>}
  </Document>;
}

function MarketingPdf({ input }: { input: VowPdfInput }) {
  return <Document title={`${input.job.title} — Project Story`} author="Vizow">
    <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Project Story" />
      <Hero job={input.job} label="Recent work" publicOnly />
      <Text style={styles.summary}>{input.job.description?.trim() || "A documented look at the work, from initial condition through result."}</Text>
      <BeforeAfter media={input.media} />
      <View style={styles.storyBox} wrap={false}>
        <Text style={styles.eyebrow}>The work</Text>
        <Text style={styles.storyTitle}>{statusLabel(input.job)} · {formatAddress(input.job, true)}</Text>
        <Text style={styles.storyText}>The project record includes {input.media.length} documented photo{input.media.length === 1 ? "" : "s"} across {input.cycleNumbers.length} cycle{input.cycleNumbers.length === 1 ? "" : "s"}.</Text>
      </View>
      <Footer />
    </Page>
    {input.media.length > 2 && <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Project Story · More Work" />
      <PhotoGrid media={input.media} limit={9} />
      <Footer />
    </Page>}
  </Document>;
}

function OneSheet({ input }: { input: VowPdfInput }) {
  const [before, after] = pickBeforeAfter(input.media);
  return <Document title={`${input.job.title} — One Sheet`} author="Vizow">
    <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Project One Sheet" />
      <Hero job={input.job} label="Project brief" publicOnly />
      <View style={styles.oneSheetLayout}>
        <View style={styles.oneSheetCopy}>
          <Text style={styles.eyebrow}>Scope</Text>
          <Text style={{ fontSize: 11, lineHeight: 1.45 }}>{input.job.description?.trim() || "Documented project work."}</Text>
          {[["Location", formatAddress(input.job, true)], ["Status", statusLabel(input.job)], ["Cycles", String(input.cycleNumbers.length)], ["Photos", String(input.media.length)]].map(([label, value]) => <View key={label} style={styles.factRow}>
            <Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text>
          </View>)}
        </View>
        <View style={styles.oneSheetVisual}>
          {[before, after].map((item, index) => <View key={index} style={{ marginBottom: 10, borderWidth: 1, borderColor: C.rule }}>
            {item ? <Image src={item.url} style={{ width: "100%", height: 205, objectFit: "cover" }} /> : <View style={styles.imageEmpty}><Text>No photo</Text></View>}
            <View style={styles.compareCaption}><Text style={styles.stage}>{index === 0 ? "Before" : "After"}</Text><Text style={styles.caption}>{item?.caption ?? ""}</Text></View>
          </View>)}
        </View>
      </View>
      <Footer />
    </Page>
  </Document>;
}

function InvoicePdf({ input }: { input: VowPdfInput }) {
  return <Document title={`${input.job.title} — Invoice`} author="Vizow">
    <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Invoice" />
      <Hero job={input.job} label="Documented billing view" />
      <View style={styles.invoiceHeader}>
        <View style={styles.invoiceParty}><Text style={styles.eyebrow}>Bill to</Text><Text style={{ fontSize: 12, fontWeight: 700 }}>{input.job.clientName}</Text><Text style={{ marginTop: 4, color: C.muted }}>{formatAddress(input.job)}</Text></View>
        <View style={styles.invoiceParty}><Text style={styles.eyebrow}>Job</Text><Text style={{ fontSize: 12, fontWeight: 700 }}>{input.job.title}</Text><Text style={{ marginTop: 4, color: C.muted }}>{statusLabel(input.job)} · Cycle {input.job.currentCycle.cycleNumber}</Text></View>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Scope & Adjustments</Text></View>
        <View style={styles.invoiceRow}><Text style={styles.invoiceDesc}>Approved job scope</Text><Text style={styles.invoiceAmount}>Included in total</Text></View>
        {input.revisions.map((revision) => <View key={revision.id} style={styles.invoiceRow} wrap={false}><Text style={styles.invoiceDesc}>Revision {revision.revisionNumber}: {revision.scopeText}</Text><Text style={styles.invoiceAmount}>{formatMoney(revision.priceChange)}</Text></View>)}
        <View style={styles.invoiceTotal}><Text style={styles.invoiceTotalLabel}>Recorded final total</Text><Text style={styles.invoiceTotalValue}>{formatMoney(input.finalPrice)}</Text></View>
        {input.finalPrice === null && <Text style={{ marginTop: 10, color: C.muted }}>No final price is recorded. Vizow does not invent billing data.</Text>}
      </View>
      <Footer />
    </Page>
  </Document>;
}

function FullVow({ input }: { input: VowPdfInput }) {
  return <Document title={`${input.job.title} — Visual of Work`} author="Vizow">
    <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Visual of Work" />
      <Hero job={input.job} label="Immutable job record" />
      <Text style={styles.summary}>{input.job.description?.trim() || "The complete documented record of this job."}</Text>
      <MetaStrip input={input} />
      <BeforeAfter media={input.media} />
      <Footer />
    </Page>
    <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Visual of Work · Timeline" />
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Project Timeline</Text><Text style={styles.sectionMeta}>{input.events.length} events</Text></View>
      {input.events.map((event) => <View key={event.id} style={styles.timelineItem} wrap={false}>
        <Text style={styles.timelineDate}>{formatDate(event.createdAt)}</Text>
        <View style={styles.timelineBody}><Text style={styles.timelineTitle}>{eventTitle(event)}</Text>{eventBody(event) && <Text style={styles.timelineText}>{eventBody(event)}</Text>}</View>
      </View>)}
      <Footer />
    </Page>
    {input.media.length > 0 && <Page size="LETTER" style={styles.page}>
      <BrandHeader kind="Visual of Work · Evidence" />
      <PhotoGrid media={input.media} />
      <Footer />
    </Page>}
  </Document>;
}

function documentFor(input: VowPdfInput) {
  switch (input.mode) {
    case "marketing": return <MarketingPdf input={input} />;
    case "one-sheet": return <OneSheet input={input} />;
    case "work-sample": return <WorkSample input={input} />;
    case "invoice": return <InvoicePdf input={input} />;
    case "full": return <FullVow input={input} />;
    default: return <FullVow input={input} />;
  }
}

export async function createVowPdfBlob(input: VowPdfInput): Promise<Blob> {
  return pdf(documentFor(input)).toBlob();
}

export function pdfFileName(job: Job, mode: PdfOutputMode): string {
  const label: Record<PdfOutputMode, string> = {
    full: "vow",
    social: "vow",
    "marketing-email": "vow",
    "customer-update": "vow",
    "customer-request": "vow",
    marketing: "marketing-project-story",
    "one-sheet": "one-sheet",
    "work-sample": "work-sample",
    invoice: "invoice",
  };
  return `${slug(job.title)}-${label[mode]}.pdf`;
}
