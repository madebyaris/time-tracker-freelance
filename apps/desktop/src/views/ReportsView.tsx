import { useMemo, useState } from 'react';
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
import { EmptyState, SegmentedControl } from '@ttf/ui';
import { entryDurationSeconds, formatDuration, formatMoney, startOfDay } from '@ttf/shared';
import { BarChart3 } from 'lucide-react';
import { Clients, Projects, TimeEntries } from '../db/repos';
import { liveQueryOptions, staticQueryOptions } from '../lib/query-client';

type Range = '7d' | '30d' | '90d';

const rangeOptions: Array<{ value: Range; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

export function ReportsView() {
  const [range, setRange] = useState<Range>('30d');
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const from = startOfDay(Date.now()) - (days - 1) * 86_400_000;
  const to = Date.now();

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
    queryKey: ['entries', 'reports', from, to],
    queryFn: () => TimeEntries.list({ from, to }),
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

  const perDay = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const ts = startOfDay(from + i * 86_400_000);
      buckets[new Date(ts).toISOString().slice(5, 10)] = 0;
    }
    for (const e of entriesQ.data ?? []) {
      const day = new Date(startOfDay(e.started_at)).toISOString().slice(5, 10);
      buckets[day] = (buckets[day] ?? 0) + entryDurationSeconds(e) / 3600;
    }
    return Object.entries(buckets).map(([day, hours]) => ({
      day,
      hours: Number(hours.toFixed(2)),
    }));
  }, [entriesQ.data, from, days]);

  const perProject = useMemo(() => {
    const totals = new Map<
      string,
      { key: string; name: string; color: string; seconds: number; revenue: number; currency: string | null }
    >();
    for (const e of entriesQ.data ?? []) {
      const proj = e.project_id ? projById.get(e.project_id) : null;
      const client = (proj?.client_id ? clientById.get(proj.client_id) : null) ??
        (e.client_id ? clientById.get(e.client_id) : null);
      const key = proj ? `project:${proj.id}` : client ? `client:${client.id}` : 'none';
      const name = proj?.name ?? (client ? `${client.name} (no project)` : 'No project');
      const color = proj?.color ?? '#71717a';
      const secs = entryDurationSeconds(e);
      const revenue = e.billable && proj?.hourly_rate ? (secs / 3600) * proj.hourly_rate : 0;
      const cur = totals.get(key) ?? {
        key,
        name,
        color,
        seconds: 0,
        revenue: 0,
        currency: proj?.currency ?? null,
      };
      cur.seconds += secs;
      cur.revenue += revenue;
      totals.set(key, cur);
    }
    return [...totals.values()].sort((a, b) => b.seconds - a.seconds);
  }, [clientById, entriesQ.data, projById]);

  const totalSecs = perProject.reduce((sum, p) => sum + p.seconds, 0);
  const avgHoursPerDay = totalSecs / 3600 / days;
  const revenueByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const group of perProject) {
      if (!group.currency || group.revenue <= 0) continue;
      totals.set(group.currency, (totals.get(group.currency) ?? 0) + group.revenue);
    }
    return [...totals.entries()]
      .map(([currency, revenue]) => ({ currency, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [perProject]);
  const revenueLabel =
    revenueByCurrency.length === 0
      ? '—'
      : revenueByCurrency.length === 1
        ? formatMoney(Math.round(revenueByCurrency[0]!.revenue), revenueByCurrency[0]!.currency)
        : revenueByCurrency
            .slice(0, 2)
            .map((item) => formatMoney(Math.round(item.revenue), item.currency))
            .join(' · ') + (revenueByCurrency.length > 2 ? ` +${revenueByCurrency.length - 2}` : '');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Reports
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
          </h1>
        </div>
        <SegmentedControl value={range} onChange={setRange} options={rangeOptions} />
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tracked" value={formatDuration(totalSecs, 'hm')} />
        <Stat label="Avg / day" value={`${avgHoursPerDay.toFixed(1)}h`} />
        <Stat label="Revenue" value={revenueLabel} />
        <Stat label="Groups" value={String(perProject.length)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <Panel title="Hours per day">
          {totalSecs === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={perDay} margin={{ top: 8, left: -12, right: 4 }}>
                <CartesianGrid stroke="rgba(113,113,122,0.18)" vertical={false} strokeDasharray="3 3" />
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
                  contentStyle={{
                    border: '1px solid rgba(113,113,122,0.2)',
                    background: '#18181b',
                    borderRadius: 10,
                    fontSize: 12,
                    color: '#fafafa',
                  }}
                  labelStyle={{ color: '#fafafa' }}
                  itemStyle={{ color: '#fafafa' }}
                />
                <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Top work">
          {perProject.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="flex flex-col gap-3">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={perProject.map((p) => ({ name: p.name, value: p.seconds / 3600 }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={70}
                    innerRadius={42}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {perProject.map((p, i) => (
                      <Cell key={i} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(2)}h`}
                    contentStyle={{
                      border: '1px solid rgba(113,113,122,0.2)',
                      background: '#18181b',
                      borderRadius: 10,
                      fontSize: 12,
                      color: '#fafafa',
                    }}
                    labelStyle={{ color: '#fafafa' }}
                    itemStyle={{ color: '#fafafa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex flex-col gap-1.5">
                {perProject.slice(0, 5).map((project) => (
                  <li key={project.key} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="flex-1 truncate">{project.name}</span>
                    <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                      {((project.seconds / Math.max(totalSecs, 1)) * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Target breakdown">
        {perProject.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="flex flex-col gap-3">
            {revenueByCurrency.length > 1 && (
              <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                {revenueByCurrency.map((item) => (
                  <span
                    key={item.currency}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950/40"
                  >
                    {item.currency}: {formatMoney(Math.round(item.revenue), item.currency)}
                  </span>
                ))}
              </div>
            )}
            <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-800">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_120px] items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <span>Target</span>
                <span className="text-right">Hours</span>
                <span className="text-right">Share</span>
                <span className="text-right">Revenue</span>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {perProject.map((project) => (
                  <li
                    key={project.key}
                    className="grid grid-cols-[minmax(0,1fr)_90px_90px_120px] items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="truncate">{project.name}</span>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      {formatDuration(project.seconds, 'hm')}
                    </div>
                    <div className="text-right text-zinc-500 dark:text-zinc-400">
                      {((project.seconds / Math.max(totalSecs, 1)) * 100).toFixed(0)}%
                    </div>
                    <div className="text-right">
                      {project.currency && project.revenue > 0
                        ? formatMoney(Math.round(project.revenue), project.currency)
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
