import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, EmptyState, Field, FieldLabel, Input, Select } from '@ttf/ui';
import { formatDuration, formatMoney } from '@ttf/shared';
import { BarChart3, Download } from 'lucide-react';
import { Clients, Projects, TimeEntries } from '../db/repos';
import { liveQueryOptions, staticQueryOptions } from '../lib/query-client';
import { exportEntriesCsv } from '../lib/csv';
import {
  defaultReportPrefs,
  loadReportPrefs,
  saveReportPrefs,
  type ReportPrefs,
} from '../lib/report-prefs';
import {
  BILLABLE_FILTERS,
  GROUP_BY_OPTIONS,
  RANGE_PRESETS,
  aggregateByDay,
  aggregateByGroup,
  aggregateTotals,
  effectiveHourlyRateCents,
  formatRevenueByCurrency,
  matchesBillableFilter,
  resolveRange,
  type ResolvedRange,
} from '../lib/reporting';

const CHART_TOOLTIP_STYLE = {
  border: '1px solid rgba(113,113,122,0.2)',
  background: '#18181b',
  borderRadius: 10,
  fontSize: 12,
  color: '#fafafa',
} as const;

function formatRangeSpan(range: ResolvedRange): string {
  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (range.days === 1) return fmt(range.from);
  return `${fmt(range.from)} – ${fmt(range.to - 86_400_000)}`;
}

export function ReportsView() {
  const [prefs, setPrefs] = useState<ReportPrefs>(defaultReportPrefs);
  const [exportStatus, setExportStatus] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const hydrated = useRef(false);

  const prefsQ = useQuery({
    queryKey: ['report-prefs'],
    queryFn: loadReportPrefs,
    ...staticQueryOptions,
  });

  useEffect(() => {
    if (hydrated.current || !prefsQ.data) return;
    hydrated.current = true;
    setPrefs(prefsQ.data);
  }, [prefsQ.data]);

  function updatePrefs(patch: Partial<ReportPrefs>) {
    setPrefs((prev) => ({ ...prev, ...patch }));
    void saveReportPrefs(patch);
  }

  const range = useMemo(
    () =>
      resolveRange(prefs.range, {
        customFrom: prefs.customFrom,
        customTo: prefs.customTo,
      }),
    [prefs.range, prefs.customFrom, prefs.customTo],
  );

  const projectsQ = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => Projects.list({ includeArchived: true }),
    ...staticQueryOptions,
  });
  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => Clients.list(),
    ...staticQueryOptions,
  });
  const entriesQ = useQuery({
    queryKey: ['entries', 'reports', range.from, range.to],
    queryFn: () => TimeEntries.list({ from: range.from, to: range.to }),
    ...liveQueryOptions,
  });

  const projById = useMemo(
    () => new Map((projectsQ.data ?? []).map((p) => [p.id, p])),
    [projectsQ.data],
  );
  const clientById = useMemo(
    () => new Map((clientsQ.data ?? []).map((client) => [client.id, client])),
    [clientsQ.data],
  );

  const entries = useMemo(
    () => (entriesQ.data ?? []).filter((entry) => matchesBillableFilter(entry, prefs.billable)),
    [entriesQ.data, prefs.billable],
  );

  const totals = useMemo(
    () => aggregateTotals(entries, projById, clientById),
    [entries, projById, clientById],
  );
  const groups = useMemo(
    () => aggregateByGroup(entries, prefs.groupBy, projById, clientById),
    [entries, prefs.groupBy, projById, clientById],
  );
  const perDay = useMemo(() => aggregateByDay(entries, range), [entries, range]);

  const effectiveRate = effectiveHourlyRateCents(totals);
  const avgHoursPerDay = totals.seconds / 3600 / range.days;

  async function handleExport() {
    setIsExporting(true);
    setExportStatus('');
    try {
      const path = await exportEntriesCsv({
        from: range.from,
        to: range.to,
        billable: prefs.billable,
        fileLabel: prefs.range.replace(/_/g, '-'),
      });
      setExportStatus(path ? `Exported to ${path}` : '');
    } catch (error) {
      setExportStatus(`Export failed: ${(error as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  }

  const groupNoun = prefs.groupBy === 'project' ? 'Projects' : prefs.groupBy === 'client' ? 'Clients' : 'Sources';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Reports
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{range.label}</h1>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {formatRangeSpan(range)} · {range.days} {range.days === 1 ? 'day' : 'days'}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel>Date range</FieldLabel>
          <Select
            value={prefs.range}
            onChange={(event) =>
              updatePrefs({ range: event.target.value as ReportPrefs['range'] })
            }
          >
            {RANGE_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel>Group by</FieldLabel>
          <Select
            value={prefs.groupBy}
            onChange={(event) =>
              updatePrefs({ groupBy: event.target.value as ReportPrefs['groupBy'] })
            }
          >
            {GROUP_BY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel>Billable</FieldLabel>
          <Select
            value={prefs.billable}
            onChange={(event) =>
              updatePrefs({ billable: event.target.value as ReportPrefs['billable'] })
            }
          >
            {BILLABLE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {prefs.range === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>From</FieldLabel>
            <Input
              type="date"
              value={prefs.customFrom}
              onChange={(event) => updatePrefs({ customFrom: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>To</FieldLabel>
            <Input
              type="date"
              value={prefs.customTo}
              onChange={(event) => updatePrefs({ customTo: event.target.value })}
            />
          </Field>
        </div>
      )}

      {exportStatus && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
          {exportStatus}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Tracked" value={formatDuration(totals.seconds, 'hm')} />
        <Stat label="Billable" value={formatDuration(totals.billableSeconds, 'hm')} />
        <Stat label="Non-billable" value={formatDuration(totals.nonBillableSeconds, 'hm')} />
        <Stat label="Revenue" value={formatRevenueByCurrency(totals.revenueByCurrency)} />
        <Stat
          label="Eff. rate"
          value={
            effectiveRate
              ? `${formatMoney(Math.round(effectiveRate.rateCents), effectiveRate.currency)}/h`
              : '—'
          }
        />
        <Stat label="Avg / day" value={`${avgHoursPerDay.toFixed(1)}h`} />
      </div>

      {totals.unratedBillableSeconds > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {formatDuration(totals.unratedBillableSeconds, 'hm')} is marked billable but has no rate
          on the entry, project, or client — it won't appear as revenue.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <Panel title="Hours per day">
          {totals.seconds === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={perDay} margin={{ top: 8, left: -12, right: 4 }}>
                <CartesianGrid
                  stroke="rgba(113,113,122,0.18)"
                  vertical={false}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="day"
                  stroke="#71717a"
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#71717a" axisLine={false} tickLine={false} fontSize={11} />
                <Tooltip
                  cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: '#fafafa' }}
                  itemStyle={{ color: '#fafafa' }}
                />
                <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title={`Top ${groupNoun.toLowerCase()}`}>
          {groups.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="flex flex-col gap-3">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={groups.map((group) => ({
                      name: group.name,
                      value: group.seconds / 3600,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={70}
                    innerRadius={42}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {groups.map((group) => (
                      <Cell key={group.key} fill={group.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(2)}h`}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ color: '#fafafa' }}
                    itemStyle={{ color: '#fafafa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex flex-col gap-1.5">
                {groups.slice(0, 5).map((group) => (
                  <li key={group.key} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="flex-1 truncate">{group.name}</span>
                    <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                      {((group.seconds / Math.max(totals.seconds, 1)) * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={`${groupNoun} breakdown`}>
        {groups.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="flex flex-col gap-3">
            {totals.revenueByCurrency.size > 1 && (
              <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                {[...totals.revenueByCurrency.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([currency, amount]) => (
                    <span
                      key={currency}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950/40"
                    >
                      {currency}: {formatMoney(Math.round(amount), currency)}
                    </span>
                  ))}
              </div>
            )}
            <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-800">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_80px_120px] items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <span>{prefs.groupBy === 'source' ? 'Source' : prefs.groupBy === 'client' ? 'Client' : 'Project'}</span>
                <span className="text-right">Hours</span>
                <span className="text-right">Billable</span>
                <span className="text-right">Share</span>
                <span className="text-right">Revenue</span>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {groups.map((group) => (
                  <li
                    key={group.key}
                    className="grid grid-cols-[minmax(0,1fr)_90px_90px_80px_120px] items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="truncate">{group.name}</span>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      {formatDuration(group.seconds, 'hm')}
                    </div>
                    <div className="text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                      {group.billableSeconds > 0 ? formatDuration(group.billableSeconds, 'hm') : '—'}
                    </div>
                    <div className="text-right text-zinc-500 dark:text-zinc-400">
                      {((group.seconds / Math.max(totals.seconds, 1)) * 100).toFixed(0)}%
                    </div>
                    <div className="text-right">
                      {group.currency && group.revenueCents > 0
                        ? formatMoney(Math.round(group.revenueCents), group.currency)
                        : '—'}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-200">
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <EmptyState
      className="border-0 py-8"
      icon={BarChart3}
      title="Nothing yet"
      description="Track some sessions and your stats will appear here."
    />
  );
}
