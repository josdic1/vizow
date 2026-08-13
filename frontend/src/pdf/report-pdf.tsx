import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

export type ReportPdfRow = Record<string, string>;

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 8.5, color: "#2a1b14" },
  eyebrow: { fontSize: 7, letterSpacing: 1.2, marginBottom: 6, color: "#d95f1c" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  meta: { fontSize: 8, color: "#6a5a50", marginBottom: 18 },
  table: { borderWidth: 1, borderColor: "#2a1b14" },
  row: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#2a1b14" },
  header: { backgroundColor: "#eee4cd" },
  cell: { flex: 1, padding: 5, borderRightWidth: 0.6, borderRightColor: "#2a1b14" },
  lastCell: { borderRightWidth: 0 },
  headerText: { fontFamily: "Helvetica-Bold", fontSize: 7 },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#6a5a50" },
});

function ReportDocument({ title, columns, rows }: { title: string; columns: string[]; rows: ReportPdfRow[] }) {
  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={styles.eyebrow}>VIZOW · REPORTING</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{rows.length} rows · Generated {new Date().toLocaleString()}</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.header]} fixed>
            {columns.map((column, index) => <View key={column} style={[styles.cell, index === columns.length - 1 ? styles.lastCell : {}]}><Text style={styles.headerText}>{column}</Text></View>)}
          </View>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row} wrap={false}>
              {columns.map((column, index) => <View key={column} style={[styles.cell, index === columns.length - 1 ? styles.lastCell : {}]}><Text>{row[column] ?? ""}</Text></View>)}
            </View>
          ))}
        </View>
        <View style={styles.footer} fixed><Text>VIZOW</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>
      </Page>
    </Document>
  );
}

export async function downloadReportPdf(title: string, columns: string[], rows: ReportPdfRow[]) {
  const blob = await pdf(<ReportDocument title={title} columns={columns} rows={rows} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "vizow-report"}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
