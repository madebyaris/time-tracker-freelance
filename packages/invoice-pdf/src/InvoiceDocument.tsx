import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatMoney } from '@ttf/shared';

export interface InvoiceLineData {
  description: string;
  hours: number; // hundredths
  rate: number; // cents/hr
  amount: number; // cents
}

export interface InvoiceData {
  number: string;
  issued_at: number;
  due_at: number | null;
  currency: string;
  subtotal: number;
  tax_rate: number; // basis points
  tax_amount: number;
  total: number;
  notes?: string | null;
  from: { name: string; email?: string | null; address?: string | null };
  to: { name: string; email?: string | null; address?: string | null };
  lines: InvoiceLineData[];
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  h1: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  muted: { color: '#64748b' },
  parties: { flexDirection: 'row', gap: 32, marginBottom: 24 },
  party: { flex: 1 },
  partyLabel: { fontSize: 8, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 },
  partyName: { fontWeight: 700, marginBottom: 2 },
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1pt solid #cbd5e1',
    paddingVertical: 6,
    fontWeight: 700,
    fontSize: 9,
    textTransform: 'uppercase',
    color: '#475569',
  },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #e2e8f0', paddingVertical: 6 },
  colDesc: { flex: 4 },
  colHours: { flex: 1, textAlign: 'right' },
  colRate: { flex: 1, textAlign: 'right' },
  colAmount: { flex: 1.2, textAlign: 'right' },
  totals: { marginTop: 16, marginLeft: 'auto', width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grandTotal: {
    borderTop: '1pt solid #0f172a',
    marginTop: 6,
    paddingTop: 6,
    fontWeight: 700,
    fontSize: 12,
  },
  notes: { marginTop: 32, padding: 12, backgroundColor: '#f8fafc' },
});

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Invoice</Text>
            <Text style={styles.muted}>#{data.number}</Text>
          </View>
          <View>
            <Text>Issued: {fmtDate(data.issued_at)}</Text>
            {data.due_at && <Text>Due: {fmtDate(data.due_at)}</Text>}
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>From</Text>
            <Text style={styles.partyName}>{data.from.name}</Text>
            {data.from.email && <Text style={styles.muted}>{data.from.email}</Text>}
            {data.from.address && <Text style={styles.muted}>{data.from.address}</Text>}
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Bill to</Text>
            <Text style={styles.partyName}>{data.to.name}</Text>
            {data.to.email && <Text style={styles.muted}>{data.to.email}</Text>}
            {data.to.address && <Text style={styles.muted}>{data.to.address}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colHours}>Hours</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.colDesc}>{line.description}</Text>
              <Text style={styles.colHours}>{(line.hours / 100).toFixed(2)}</Text>
              <Text style={styles.colRate}>{formatMoney(line.rate, data.currency)}</Text>
              <Text style={styles.colAmount}>{formatMoney(line.amount, data.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney(data.subtotal, data.currency)}</Text>
          </View>
          {data.tax_rate > 0 && (
            <View style={styles.totalRow}>
              <Text>Tax ({(data.tax_rate / 100).toFixed(2)}%)</Text>
              <Text>{formatMoney(data.tax_amount, data.currency)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text>Total</Text>
            <Text>{formatMoney(data.total, data.currency)}</Text>
          </View>
        </View>

        {data.notes && (
          <View style={styles.notes}>
            <Text>{data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
