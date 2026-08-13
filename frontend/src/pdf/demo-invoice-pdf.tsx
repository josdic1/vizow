import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

export type DemoInvoicePdfValues = {
  labor: number;
  materials: number;
  adjustment: number;
};

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", color: "#2a1b14", fontSize: 9 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: "#2a1b14", paddingBottom: 14, marginBottom: 18 },
  brand: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  eyebrow: { fontSize: 7, letterSpacing: 1.6, color: "#e66723", marginTop: 4 },
  invoiceLabel: { fontSize: 17, fontFamily: "Helvetica-Bold", textAlign: "right" },
  invoiceNo: { fontSize: 8, marginTop: 5, textAlign: "right" },
  parties: { flexDirection: "row", gap: 24, marginBottom: 22 },
  party: { flex: 1 },
  label: { fontSize: 7, letterSpacing: 1.2, color: "#e66723", marginBottom: 5 },
  strong: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 4 },
  muted: { color: "#66584f", lineHeight: 1.4 },
  table: { borderWidth: 1.2, borderColor: "#2a1b14" },
  row: { flexDirection: "row", borderBottomWidth: 0.7, borderBottomColor: "#2a1b14" },
  head: { backgroundColor: "#eee4cd" },
  description: { flex: 1, padding: 9 },
  amount: { width: 110, padding: 9, borderLeftWidth: 0.7, borderLeftColor: "#2a1b14", textAlign: "right" },
  headText: { fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  total: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 18, marginTop: 14, paddingTop: 12, borderTopWidth: 2, borderTopColor: "#2a1b14" },
  totalLabel: { fontSize: 8, letterSpacing: 1.2 },
  totalValue: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  note: { marginTop: 26, padding: 12, borderLeftWidth: 4, borderLeftColor: "#e66723", backgroundColor: "#f5efdf", lineHeight: 1.45 },
  footer: { position: "absolute", left: 42, right: 42, bottom: 30, flexDirection: "row", justifyContent: "space-between", color: "#66584f", fontSize: 7 },
});

function InvoiceDocument({ labor, materials, adjustment }: DemoInvoicePdfValues) {
  const total = labor + materials + adjustment;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.top}>
          <View><Text style={styles.brand}>VIZOW</Text><Text style={styles.eyebrow}>VISUAL OF WORK · WORK INVOICE</Text></View>
          <View><Text style={styles.invoiceLabel}>INVOICE</Text><Text style={styles.invoiceNo}>#VZ-0826-041 · AUG 13, 2026</Text></View>
        </View>
        <View style={styles.parties}>
          <View style={styles.party}><Text style={styles.label}>BILL TO</Text><Text style={styles.strong}>Eli Collins</Text><Text style={styles.muted}>28 Ridgefield Avenue{`\n`}West Orange, NJ</Text></View>
          <View style={styles.party}><Text style={styles.label}>JOB</Text><Text style={styles.strong}>Dining room dimmer replacement</Text><Text style={styles.muted}>Cycle 1 · Completed{`\n`}6 evidence photos</Text></View>
        </View>
        <View style={styles.table}>
          <View style={[styles.row, styles.head]}><View style={styles.description}><Text style={styles.headText}>DESCRIPTION</Text></View><View style={styles.amount}><Text style={styles.headText}>AMOUNT</Text></View></View>
          <View style={styles.row}><View style={styles.description}><Text>Labor · dimmer replacement</Text></View><View style={styles.amount}><Text>${labor.toFixed(2)}</Text></View></View>
          <View style={styles.row}><View style={styles.description}><Text>Materials · switch, plate, connectors</Text></View><View style={styles.amount}><Text>${materials.toFixed(2)}</Text></View></View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}><View style={styles.description}><Text>Approved change · additional box repair</Text></View><View style={styles.amount}><Text>${adjustment.toFixed(2)}</Text></View></View>
        </View>
        <View style={styles.total}><Text style={styles.totalLabel}>TOTAL DUE</Text><Text style={styles.totalValue}>${total.toFixed(2)}</Text></View>
        <View style={styles.note}><Text style={styles.strong}>Approved change is part of the Job record.</Text><Text>Scope history, approval, visit evidence, and completion remain attached to the Visual of Work. This invoice is generated from that record rather than reconstructed from notes and files.</Text></View>
        <View style={styles.footer}><Text>VIZOW · DEMO INVOICE</Text><Text>Demo-only · non-persistent</Text></View>
      </Page>
    </Document>
  );
}

export async function downloadDemoInvoicePdf(values: DemoInvoicePdfValues) {
  const blob = await pdf(<InvoiceDocument {...values} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vizow-demo-invoice.pdf";
  link.click();
  URL.revokeObjectURL(url);
}
