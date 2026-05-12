import { Document, Image, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatMoney } from '@ttf/shared';

export interface InvoiceLineData {
  description: string;
  hours: number; // hundredths of an hour
  rate: number; // cents per hour
  amount: number; // cents
  kind?: 'time' | 'fixed';
  work_started_at?: number | null;
  work_ended_at?: number | null;
}

export interface InvoiceParty {
  name: string;
  email?: string | null;
  address?: string | null;
  tax_id?: string | null;
  logo_data?: string | null;
  website?: string | null;
  phone?: string | null;
}

export interface InvoiceData {
  number: string;
  issued_at: number;
  due_at: number | null;
  currency: string;
  subtotal: number;
  tax_rate: number; // basis points (e.g. 1000 = 10%)
  tax_amount: number;
  total: number;
  notes?: string | null;
  from: InvoiceParty;
  to: InvoiceParty;
  lines: InvoiceLineData[];
  payment_instructions?: string | null;
  signature_data?: string | null;
  signature_name?: string | null;
}

const NAVY = '#0f172a';
const SLATE = '#334155';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const SUBTLE_BG = '#f8fafc';
const ACCENT = '#0ea5e9';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 72,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: NAVY,
    lineHeight: 1.35,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    borderBottom: `1pt solid ${NAVY}`,
    paddingBottom: 20,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 0,
    paddingRight: 18,
  },
  logo: { width: 56, height: 56, borderRadius: 6, objectFit: 'contain' },
  brandText: { flexDirection: 'column', flexShrink: 1 },
  brandName: { fontSize: 16, fontWeight: 700, color: NAVY },
  brandContact: { fontSize: 9, color: MUTED, marginTop: 2 },

  titleBlock: { alignItems: 'flex-end', width: 178, flexShrink: 0 },
  eyebrow: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: MUTED,
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 6, textAlign: 'right' },
  metaRow: { flexDirection: 'row', gap: 8, fontSize: 9, color: SLATE },
  metaLabel: { color: MUTED },

  parties: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  party: {
    flex: 1,
    padding: 12,
    backgroundColor: SUBTLE_BG,
    borderLeft: `2pt solid ${ACCENT}`,
  },
  partyLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: MUTED,
    marginBottom: 6,
  },
  partyName: { fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 3 },
  partyLine: { fontSize: 9, color: SLATE, marginTop: 1 },
  partyMeta: { fontSize: 8, color: MUTED, marginTop: 4 },

  table: { marginTop: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    color: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontWeight: 700,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${BORDER}`,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  rowAlt: { backgroundColor: SUBTLE_BG },
  colDesc: { flex: 4, paddingRight: 6 },
  colHours: { flex: 1, textAlign: 'right' },
  colRate: { flex: 1.2, textAlign: 'right' },
  colAmount: { flex: 1.3, textAlign: 'right' },
  lineDescription: { color: NAVY },
  lineMeta: { marginTop: 2, fontSize: 8, color: MUTED },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  notesCol: { flex: 1.4, paddingRight: 16 },
  notesBlock: {
    padding: 12,
    borderLeft: `2pt solid ${BORDER}`,
    backgroundColor: SUBTLE_BG,
  },
  notesLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: MUTED,
    marginBottom: 4,
  },
  notesBody: { fontSize: 9, color: SLATE, lineHeight: 1.5 },

  totals: { flex: 1, alignSelf: 'flex-start' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    fontSize: 10,
  },
  totalLabel: { color: SLATE },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `1pt solid ${NAVY}`,
    marginTop: 6,
    paddingTop: 8,
    fontWeight: 700,
    fontSize: 13,
    color: NAVY,
  },

  payment: {
    marginTop: 24,
    padding: 14,
    border: `1pt solid ${BORDER}`,
    borderRadius: 4,
  },
  paymentLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: MUTED,
    marginBottom: 6,
  },
  paymentBody: { fontSize: 9.5, color: SLATE, lineHeight: 1.5 },

  signatureBlock: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  signatureBox: { width: 200, alignItems: 'flex-start' },
  signatureLine: {
    borderBottom: `0.75pt solid ${NAVY}`,
    width: '100%',
    paddingTop: 28,
    marginBottom: 4,
  },
  signatureImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    maxHeight: 48,
    maxWidth: 160,
    objectFit: 'contain',
  },
  signatureCaption: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  signatureName: { fontSize: 10, color: NAVY, fontWeight: 700, marginTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: MUTED,
    letterSpacing: 0.3,
  },
});

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sameDate(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function fmtWorkPeriod(line: InvoiceLineData): string | null {
  if (!line.work_started_at) return null;
  if (!line.work_ended_at) return `${fmtDateTime(line.work_started_at)} - running`;
  if (sameDate(line.work_started_at, line.work_ended_at)) {
    return `${fmtDate(line.work_started_at)}, ${fmtTime(line.work_started_at)} - ${fmtTime(
      line.work_ended_at,
    )}`;
  }
  return `${fmtDateTime(line.work_started_at)} - ${fmtDateTime(line.work_ended_at)}`;
}

function splitLines(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function PartyBlock({ label, party }: { label: string; party: InvoiceParty }) {
  const addressLines = splitLines(party.address);
  return (
    <View style={styles.party}>
      <Text style={styles.partyLabel}>{label}</Text>
      <Text style={styles.partyName}>{party.name}</Text>
      {addressLines.map((line, i) => (
        <Text key={`addr-${i}`} style={styles.partyLine}>
          {line}
        </Text>
      ))}
      {party.email && <Text style={styles.partyMeta}>{party.email}</Text>}
      {party.phone && <Text style={styles.partyMeta}>{party.phone}</Text>}
      {party.website && <Text style={styles.partyMeta}>{party.website}</Text>}
      {party.tax_id && <Text style={styles.partyMeta}>Tax ID: {party.tax_id}</Text>}
    </View>
  );
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const hasLogo = Boolean(data.from.logo_data);
  const signatureName = data.signature_name?.trim() || data.from.name;

  return (
    <Document title={`Invoice ${data.number}`} author={data.from.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            {hasLogo && <Image src={data.from.logo_data as string} style={styles.logo} />}
            <View style={styles.brandText}>
              <Text style={styles.brandName}>{data.from.name}</Text>
              {data.from.email && <Text style={styles.brandContact}>{data.from.email}</Text>}
              {data.from.website && <Text style={styles.brandContact}>{data.from.website}</Text>}
            </View>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Invoice</Text>
            <Text style={styles.title}>#{data.number}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text>{fmtDate(data.issued_at)}</Text>
            </View>
            {data.due_at && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Due</Text>
                <Text>{fmtDate(data.due_at)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.parties}>
          <PartyBlock label="From" party={data.from} />
          <PartyBlock label="Bill to" party={data.to} />
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colHours}>Hours</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {data.lines.map((line, i) => {
            const isFixed = line.kind === 'fixed' || line.hours <= 0;
            const workPeriod = fmtWorkPeriod(line);
            return (
              <View key={i} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <View style={styles.colDesc}>
                  <Text style={styles.lineDescription}>{line.description}</Text>
                  {workPeriod && <Text style={styles.lineMeta}>{workPeriod}</Text>}
                </View>
                <Text style={styles.colHours}>
                  {isFixed ? 'Fixed' : (line.hours / 100).toFixed(2)}
                </Text>
                <Text style={styles.colRate}>
                  {isFixed ? '-' : formatMoney(line.rate, data.currency)}
                </Text>
                <Text style={styles.colAmount}>{formatMoney(line.amount, data.currency)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.notesCol}>
            {data.notes && (
              <View style={styles.notesBlock}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesBody}>{data.notes}</Text>
              </View>
            )}
          </View>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text>{formatMoney(data.subtotal, data.currency)}</Text>
            </View>
            {data.tax_rate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({(data.tax_rate / 100).toFixed(2)}%)</Text>
                <Text>{formatMoney(data.tax_amount, data.currency)}</Text>
              </View>
            )}
            <View style={styles.grandTotal}>
              <Text>Total due</Text>
              <Text>{formatMoney(data.total, data.currency)}</Text>
            </View>
          </View>
        </View>

        {data.payment_instructions && (
          <View style={styles.payment}>
            <Text style={styles.paymentLabel}>Payment instructions</Text>
            <Text style={styles.paymentBody}>{data.payment_instructions}</Text>
          </View>
        )}

        <View style={styles.signatureBlock}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              {data.signature_data && (
                <Image src={data.signature_data} style={styles.signatureImage} />
              )}
            </View>
            <Text style={styles.signatureCaption}>Authorized signature</Text>
            <Text style={styles.signatureName}>{signatureName}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Thank you for your business · Invoice #{data.number}
        </Text>
      </Page>
    </Document>
  );
}
