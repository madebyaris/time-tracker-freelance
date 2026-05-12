import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { pdf } from '@react-pdf/renderer';
import { writeFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import {
  Button,
  Combobox,
  EmptyState,
  Field,
  FieldHint,
  FieldLabel,
  Input,
  Textarea,
} from '@ttf/ui';
import { InvoiceDocument, type InvoiceData, type InvoiceLineData } from '@ttf/invoice-pdf';
import {
  applyTax,
  entryDurationSeconds,
  formatMoney,
  lineAmount,
  parseMoney,
  secondsToHundredthsOfHour,
} from '@ttf/shared';
import { FileText, FileDown, Plus } from 'lucide-react';
import { Clients, Invoices, Projects, TimeEntries } from '../db/repos';
import { Settings } from '../db/repos';
import { open } from '@tauri-apps/plugin-shell';
import { liveQueryOptions, staticQueryOptions } from '../lib/query-client';
import { getEntryBilling } from '../lib/billing';

function monthRange(): { from: number; to: number } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return { from, to };
}

const currencies = ['USD', 'EUR', 'GBP', 'IDR', 'JPY', 'CAD', 'AUD'];
const currencyOptions = currencies.map((currency) => ({ value: currency, label: currency }));

function parseExchangeRate(value: string): number | null {
  const rate = Number(value.trim());
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function convertCents(cents: number, exchangeRate: number): number {
  return Math.round(cents * exchangeRate);
}

function parseExtraCharges(input: string): InvoiceLineData[] {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return rows.map((line, index) => {
    const separatorIndex = line.lastIndexOf('|');
    if (separatorIndex < 0) {
      throw new Error(`Extra charge line ${index + 1}: use "Description | Amount"`);
    }

    const description = line.slice(0, separatorIndex).trim();
    const amount = parseMoney(line.slice(separatorIndex + 1));
    if (!description) throw new Error(`Extra charge line ${index + 1}: add a description`);
    if (amount == null || amount <= 0) {
      throw new Error(`Extra charge line ${index + 1}: add a positive amount`);
    }

    return {
      kind: 'fixed',
      description,
      hours: 0,
      rate: 0,
      amount,
    };
  });
}

export function InvoicesView() {
  const qc = useQueryClient();
  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => Clients.list(),
    ...staticQueryOptions,
  });
  const invoicesQ = useQuery({
    queryKey: ['invoices'],
    queryFn: () => Invoices.list(),
    ...liveQueryOptions,
  });
  const projectsQ = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => Projects.list({ includeArchived: true }),
    ...staticQueryOptions,
  });

  const [clientId, setClientId] = useState<string | null>(null);
  const { from, to } = monthRange();
  const [fromStr, setFromStr] = useState(new Date(from).toISOString().slice(0, 10));
  const [toStr, setToStr] = useState(new Date(to).toISOString().slice(0, 10));
  const [taxPercent, setTaxPercent] = useState('0');
  const [invoiceCurrency, setInvoiceCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [extraChargesText, setExtraChargesText] = useState('');

  const generate = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Select a client');
      const c = (clientsQ.data ?? []).find((x) => x.id === clientId);
      if (!c) throw new Error('Client not found');
      const targetCurrency = (invoiceCurrency || c.currency).toUpperCase();
      const needsConversion = targetCurrency !== c.currency;
      const manualExchangeRate = needsConversion ? parseExchangeRate(exchangeRate) : 1;
      if (!manualExchangeRate) {
        throw new Error(`Enter an exchange rate from ${c.currency} to ${targetCurrency}`);
      }
      const fromT = new Date(fromStr + 'T00:00:00').getTime();
      const toT = new Date(toStr + 'T23:59:59.999').getTime() + 1;
      const entries = await TimeEntries.listForClientRange(clientId, fromT, toT);
      const projById = new Map((projectsQ.data ?? []).map((p) => [p.id, p]));
      const lineRows: Array<InvoiceLineData & { project_id: string | null }> = [];
      for (const e of entries) {
        const project = e.project_id ? (projById.get(e.project_id) ?? null) : null;
        // Use entry → project → client billing precedence so overrides and
        // client-only entries show up on the invoice (not just project ones).
        const billing = getEntryBilling(e, project, c);
        if (!billing.rate) continue;
        const secs = entryDurationSeconds(e);
        const h = secondsToHundredthsOfHour(secs);
        const amount = lineAmount(h, billing.rate);
        lineRows.push({
          kind: 'time',
          project_id: e.project_id,
          description: e.description || project?.name || c.name,
          hours: h,
          rate: convertCents(billing.rate, manualExchangeRate),
          amount: convertCents(amount, manualExchangeRate),
          work_started_at: e.started_at,
          work_ended_at: e.ended_at,
        });
      }
      const extraChargeRows = parseExtraCharges(extraChargesText);
      for (const line of extraChargeRows) {
        lineRows.push({ ...line, project_id: null });
      }
      if (lineRows.length === 0) {
        throw new Error('No billable entries or extra charges in this range');
      }
      const subtotal = lineRows.reduce((s, l) => s + l.amount, 0);
      const bps = Math.max(0, Math.round((parseFloat(taxPercent) || 0) * 100));
      const taxAmt = applyTax(subtotal, bps);
      const total = subtotal + taxAmt;
      const number = await Invoices.nextNumber();
      const issuedAt = Date.now();
      const dueAt = issuedAt + 30 * 86_400_000;

      const [
        fromName,
        fromEmail,
        fromAddress,
        fromTaxId,
        fromLogo,
        fromSignature,
        paymentInstructions,
      ] = await Promise.all([
        Settings.get('owner_name'),
        Settings.get('owner_email'),
        Settings.get('owner_address'),
        Settings.get('owner_tax_id'),
        Settings.get('owner_logo_data'),
        Settings.get('owner_signature_data'),
        Settings.get('owner_payment_instructions'),
      ]);

      const data: InvoiceData = {
        number,
        issued_at: issuedAt,
        due_at: dueAt,
        currency: targetCurrency,
        subtotal,
        tax_rate: bps,
        tax_amount: taxAmt,
        total,
        notes: [
          `Period ${fromStr} - ${toStr}`,
          needsConversion
            ? `Converted from ${c.currency} at 1 ${c.currency} = ${manualExchangeRate} ${targetCurrency}.`
            : null,
          extraChargeRows.length > 0
            ? `${extraChargeRows.length} additional charge(s) included.`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
        from: {
          name: (fromName && fromName.trim()) || 'You',
          email: fromEmail || null,
          address: fromAddress || null,
          tax_id: fromTaxId || null,
          logo_data: fromLogo || null,
        },
        to: {
          name: c.name,
          email: c.email ?? null,
          address: c.address ?? null,
          tax_id: c.tax_id ?? null,
          phone: c.phone ?? null,
          website: c.website ?? null,
        },
        lines: lineRows.map(({ project_id: _p, ...rest }) => rest),
        payment_instructions: paymentInstructions || null,
        signature_data: fromSignature || null,
        signature_name: (fromName && fromName.trim()) || null,
      };

      const doc = <InvoiceDocument data={data} />;
      const blob = await pdf(doc).toBlob();
      const ab = await blob.arrayBuffer();
      const defPath = `Invoice-${number}.pdf`;
      const out = await save({
        title: 'Save invoice PDF',
        defaultPath: defPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!out) return null;

      try {
        await writeFile(out, new Uint8Array(ab));
      } catch (err) {
        throw new Error(
          `Could not save PDF to ${out}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }

      const inv = await Invoices.createWithLines({
        client_id: clientId,
        number,
        issued_at: issuedAt,
        due_at: dueAt,
        currency: targetCurrency,
        subtotal,
        tax_rate: bps,
        total,
        notes: data.notes ?? null,
        lines: lineRows.map((l) => ({
          project_id: l.project_id,
          description: l.description,
          hours: l.hours,
          rate: l.rate,
          amount: l.amount,
        })),
      });
      await Invoices.setPdfPath(inv.id, out);
      return out;
    },
    onSuccess: (path) => {
      if (path) void open(path);
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const clients = clientsQ.data ?? [];
  const invoices = invoicesQ.data ?? [];
  const selectedClient = clients.find((client) => client.id === clientId) ?? null;
  const baseCurrency = selectedClient?.currency ?? 'USD';
  const effectiveInvoiceCurrency = invoiceCurrency || baseCurrency;
  const needsConversion = Boolean(selectedClient && effectiveInvoiceCurrency !== baseCurrency);

  function selectClient(nextClientId: string | null) {
    setClientId(nextClientId);
    const nextClient = clients.find((client) => client.id === nextClientId);
    if (nextClient) {
      setInvoiceCurrency(nextClient.currency);
      setExchangeRate('1');
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header>
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Invoices
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Bill tracked time</h1>
      </header>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field className="sm:col-span-2">
            <FieldLabel>Client</FieldLabel>
            <Combobox
              value={clientId}
              onChange={selectClient}
              options={clients.map((c) => ({ value: c.id, label: c.name, hint: c.currency }))}
              placeholder="Select client"
              searchPlaceholder="Find client…"
              emptyLabel="Create a client first"
              allowClear={false}
            />
          </Field>
          <Field>
            <FieldLabel>From</FieldLabel>
            <Input type="date" value={fromStr} onChange={(e) => setFromStr(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>To</FieldLabel>
            <Input type="date" value={toStr} onChange={(e) => setToStr(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Tax %</FieldLabel>
            <Input
              type="number"
              step="0.01"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Invoice currency</FieldLabel>
            <Combobox
              value={effectiveInvoiceCurrency}
              onChange={(value) => {
                const nextCurrency = value ?? baseCurrency;
                setInvoiceCurrency(nextCurrency);
                if (nextCurrency === baseCurrency) setExchangeRate('1');
              }}
              options={currencyOptions}
              placeholder="Currency"
              searchPlaceholder="Find currency…"
              emptyLabel="No currency"
              allowClear={false}
            />
          </Field>
          <Field>
            <FieldLabel>Exchange rate</FieldLabel>
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={needsConversion ? exchangeRate : '1'}
              onChange={(e) => setExchangeRate(e.target.value)}
              disabled={!needsConversion}
            />
          </Field>
          <Field className="sm:col-span-4">
            <FieldLabel>Extra charges</FieldLabel>
            <Textarea
              rows={3}
              value={extraChargesText}
              onChange={(e) => setExtraChargesText(e.target.value)}
              placeholder={'Software app | 49.00\nStock assets | 12.50'}
            />
          </Field>
        </div>
        <FieldHint className="mt-3">
          Pulls billable entries linked to the client (project entries and client-only entries),
          honors per-entry rate overrides, shows each work date/time on the PDF, and saves the
          invoice in {effectiveInvoiceCurrency}
          {needsConversion
            ? ` at 1 ${baseCurrency} = ${exchangeRate} ${effectiveInvoiceCurrency}`
            : ''}
          . Extra charges use the invoice currency and the format "Description | Amount".
        </FieldHint>
        <div className="mt-4 flex items-center justify-end gap-2">
          {generate.error && (
            <span className="text-xs text-red-600">{(generate.error as Error).message}</span>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={() => generate.mutate()}
            disabled={!clientId || generate.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            Generate invoice
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Generated invoices and their PDFs will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid grid-cols-[1fr_120px_120px_60px] items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            <span>Invoice</span>
            <span>Issued</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {invoices.map((i) => (
              <li
                key={i.id}
                className="grid grid-cols-[1fr_120px_120px_60px] items-center gap-3 px-3 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
              >
                <span className="font-medium">{i.number}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {new Date(i.issued_at).toLocaleDateString()}
                </span>
                <span className="text-right font-mono tabular-nums">
                  {formatMoney(i.total, i.currency)}
                </span>
                <span className="text-right">
                  {i.pdf_path && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Open PDF"
                      onClick={() => void open(i.pdf_path!)}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
