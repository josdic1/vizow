import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

export type JobDocumentPdfValues = {
  type: "invoice" | "sow" | "proposal";
  clientName: string;
  jobTitle: string;
  property: string;
  location: string;
  scope: string;
  terms: string;
  amount: number | null;
  status: string;
  cycleNumber: number;
  evidenceCount: number;
};

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", color: "#2a1b14", fontSize: 9 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: "#2a1b14", paddingBottom: 14, marginBottom: 18 },
  brand: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  eyebrow: { marginTop: 4, color: "#e66723", fontSize: 7, letterSpacing: 1.5 },
  docLabel: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "right" },
  generated: { marginTop: 5, color: "#66584f", fontSize: 7.5, textAlign: "right" },
  metaRow: { flexDirection: "row", gap: 22, marginBottom: 20 },
  metaBlock: { flex: 1 },
  label: { marginBottom: 5, color: "#e66723", fontSize: 7, letterSpacing: 1.15 },
  strong: { marginBottom: 4, fontFamily: "Helvetica-Bold", fontSize: 11 },
  muted: { color: "#66584f", lineHeight: 1.45 },
  section: { marginTop: 8, marginBottom: 17 },
  sectionTitle: { paddingBottom: 6, borderBottomWidth: 1.3, borderBottomColor: "#2a1b14", fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1.1 },
  body: { paddingTop: 10, fontSize: 10, lineHeight: 1.55 },
  amountBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, padding: 13, borderWidth: 1.3, borderColor: "#2a1b14", backgroundColor: "#eee4cd" },
  amountLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.1 },
  amountValue: { fontSize: 19, fontFamily: "Helvetica-Bold" },
  truth: { marginTop: 16, padding: 11, borderLeftWidth: 4, borderLeftColor: "#e66723", backgroundColor: "#f5efdf", color: "#5e5149", fontSize: 8, lineHeight: 1.45 },
  footer: { position: "absolute", left: 42, right: 42, bottom: 28, flexDirection: "row", justifyContent: "space-between", color: "#66584f", fontSize: 7 },
});

function documentLabel(type: JobDocumentPdfValues["type"]) {
  if (type === "sow") return "SCOPE OF WORK";
  return type.toUpperCase();
}

function amountLabel(type: JobDocumentPdfValues["type"]) {
  return type === "invoice" ? "AMOUNT DUE" : "PROPOSED AMOUNT";
}

function JobDocument(values: JobDocumentPdfValues) {
  const propertyLine = [values.property, values.location].filter(Boolean).join(" · ");
  const amountText = values.amount === null ? "Not entered" : `$${values.amount.toFixed(2)}`;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.top}>
          <View><Text style={styles.brand}>VIZOW</Text><Text style={styles.eyebrow}>VISUAL OF WORK · GENERATED FROM JOB RECORD</Text></View>
          <View><Text style={styles.docLabel}>{documentLabel(values.type)}</Text><Text style={styles.generated}>Generated {new Date().toLocaleDateString()}</Text></View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>CLIENT</Text>
            <Text style={styles.strong}>{values.clientName}</Text>
            <Text style={styles.muted}>{propertyLine || "Property not entered"}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>JOB</Text>
            <Text style={styles.strong}>{values.jobTitle}</Text>
            <Text style={styles.muted}>{values.status} · Cycle {values.cycleNumber} · {values.evidenceCount} evidence item{values.evidenceCount === 1 ? "" : "s"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{values.type === "proposal" ? "PROPOSED WORK" : "SCOPE / WORK DESCRIPTION"}</Text>
          <Text style={styles.body}>{values.scope}</Text>
        </View>

        {values.type !== "sow" ? (
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>{amountLabel(values.type)}</Text>
            <Text style={styles.amountValue}>{amountText}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TERMS / NOTES</Text>
          <Text style={styles.body}>{values.terms || "—"}</Text>
        </View>

        <View style={styles.truth}>
          <Text>This document was generated from the selected Vizow Job record. Job identity, client, property, cycle, status, and evidence count come from the record. Any amount or edited wording shown here was entered during document creation.</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>VIZOW · {documentLabel(values.type)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadJobDocumentPdf(values: JobDocumentPdfValues) {
  const blob = await pdf(<JobDocument {...values} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = values.jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "job";
  link.download = `vizow-${values.type}-${slug}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
