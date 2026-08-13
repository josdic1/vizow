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
  record: { marginBottom: 12, borderWidth: 1, borderColor: "#2a1b14" },
  recordHead: { flexDirection: "row", justifyContent: "space-between", gap: 12, padding: 7, backgroundColor: "#eee4cd", borderBottomWidth: 1, borderBottomColor: "#2a1b14" },
  recordHeadText: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  recordIndex: { fontSize: 7, color: "#6a5a50" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap" },
  detailCell: { width: "50%", padding: 7, borderBottomWidth: 0.5, borderBottomColor: "#b8ad96" },
  detailLabel: { marginBottom: 2, fontSize: 6.5, letterSpacing: 0.8, color: "#d95f1c" },
  detailValue: { fontSize: 8.2, lineHeight: 1.35 },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#6a5a50" },
});

function TableReport({ title, columns, rows }: { title: string; columns: string[]; rows: ReportPdfRow[] }) {
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <Text style={styles.eyebrow}>VIZOW · REPORTING</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>{rows.length} Jobs · {columns.length} fields · Generated {new Date().toLocaleString()}</Text>
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
  );
}

function DetailReport({ title, columns, rows }: { title: string; columns: string[]; rows: ReportPdfRow[] }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.eyebrow}>VIZOW · REPORTING</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>{rows.length} Jobs · {columns.length} fields · Detailed record view · Generated {new Date().toLocaleString()}</Text>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.record} wrap={false}>
          <View style={styles.recordHead}>
            <Text style={styles.recordHeadText}>{row.Job || row.Client || `Job ${rowIndex + 1}`}</Text>
            <Text style={styles.recordIndex}>{rowIndex + 1} / {rows.length}</Text>
          </View>
          <View style={styles.detailGrid}>
            {columns.map((column) => (
              <View key={column} style={styles.detailCell}>
                <Text style={styles.detailLabel}>{column.toUpperCase()}</Text>
                <Text style={styles.detailValue}>{row[column] || "—"}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <View style={styles.footer} fixed><Text>VIZOW</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>
    </Page>
  );
}

function ReportDocument({ title, columns, rows }: { title: string; columns: string[]; rows: ReportPdfRow[] }) {
  const detailed = columns.length > 10;
  return <Document>{detailed ? <DetailReport title={title} columns={columns} rows={rows} /> : <TableReport title={title} columns={columns} rows={rows} />}</Document>;
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
