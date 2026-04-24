import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@ttf/ui';
import { formatDuration, startOfDay, syncableTableNames } from '@ttf/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const key = 'ttf_web_token';
const bu = 'ttf_base_url';

type MeResponse = { id: string; email: string; name: string | null };

type PullResponse = {
  server_now: number;
  batches: { table: (typeof syncableTableNames)[number]; rows: Record<string, unknown>[] }[];
};

type ClientRow = {
  id: string;
  name: string;
  deleted_at?: number | null;
};

type ProjectRow = {
  id: string;
  client_id?: string | null;
  name: string;
  billable?: boolean;
  color?: string | null;
  deleted_at?: number | null;
};

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  deleted_at?: number | null;
};

type TimeEntryRow = {
  id: string;
  project_id?: string | null;
  client_id?: string | null;
  description?: string | null;
  started_at: number;
  ended_at?: number | null;
  paused_at?: number | null;
  paused_seconds?: number;
  billable?: boolean;
  deleted_at?: number | null;
};

type DashboardSnapshot = {
  serverNow: number;
  totals: {
    last7dSeconds: number;
    todaySeconds: number;
    billableSeconds: number;
    activeSeconds: number;
  };
  counts: {
    clients: number;
    projects: number;
    invoices: number;
    runningEntries: number;
  };
  daily: { day: string; seconds: number }[];
  projectBreakdown: { name: string; seconds: number; color: string }[];
  recentEntries: Array<TimeEntryRow & { targetName: string }>;
  openInvoices: InvoiceRow[];
};

function rowsFor<T>(snapshot: PullResponse | undefined, table: (typeof syncableTableNames)[number]): T[] {
  return (snapshot?.batches.find((batch) => batch.table === table)?.rows ?? []) as T[];
}

function isActive(row: { deleted_at?: number | null }): boolean {
  return row.deleted_at == null;
}

function durationSeconds(entry: TimeEntryRow, now: number): number {
  const end = entry.ended_at ?? entry.paused_at ?? now;
  const pausedSecs = entry.paused_seconds ?? 0;
  return Math.max(0, Math.floor((end - entry.started_at) / 1000) - pausedSecs);
}

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ts);
}

function createDashboardSnapshot(sync: PullResponse | undefined): DashboardSnapshot | null {
  if (!sync) return null;

  const now = sync.server_now;
  const clients = rowsFor<ClientRow>(sync, 'clients').filter(isActive);
  const projects = rowsFor<ProjectRow>(sync, 'projects').filter(isActive);
  const invoices = rowsFor<InvoiceRow>(sync, 'invoices').filter(isActive);
  const timeEntries = rowsFor<TimeEntryRow>(sync, 'time_entries').filter(isActive);

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  const runningEntries = timeEntries.filter((entry) => entry.ended_at == null);
  const todayStart = startOfDay(now);
  const last7Start = startOfDay(now - 6 * 86_400_000);

  let todaySeconds = 0;
  let last7dSeconds = 0;
  let billableSeconds = 0;
  let activeSeconds = 0;

  const byProject = new Map<string, { name: string; seconds: number; color: string }>();
  const byDay = new Map<string, number>();

  for (let i = 0; i < 7; i += 1) {
    const day = startOfDay(last7Start + i * 86_400_000);
    byDay.set(new Date(day).toLocaleDateString(undefined, { weekday: 'short' }), 0);
  }

  for (const entry of timeEntries) {
    const seconds = durationSeconds(entry, now);
    if (entry.ended_at == null) activeSeconds += seconds;
    if (entry.billable !== false) billableSeconds += seconds;
    if (entry.started_at >= todayStart) todaySeconds += seconds;
    if (entry.started_at >= last7Start) last7dSeconds += seconds;

    if (entry.started_at >= last7Start) {
      const dayKey = new Date(startOfDay(entry.started_at)).toLocaleDateString(undefined, {
        weekday: 'short',
      });
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + seconds);
    }

    const projectName = projectNames.get(entry.project_id ?? '');
    const clientName = clientNames.get(entry.client_id ?? '');
    const targetName = projectName ?? (clientName ? `${clientName} (no project)` : 'Unassigned');
    const targetKey = entry.project_id ? `project:${entry.project_id}` : entry.client_id ? `client:${entry.client_id}` : 'unassigned';
    const current = byProject.get(targetKey) ?? {
      name: targetName,
      seconds: 0,
      color:
        projects.find((project) => project.id === entry.project_id)?.color?.toString() ?? '#64748b',
    };
    current.seconds += seconds;
    byProject.set(targetKey, current);
  }

  return {
    serverNow: now,
    totals: { last7dSeconds, todaySeconds, billableSeconds, activeSeconds },
    counts: {
      clients: clients.length,
      projects: projects.length,
      invoices: invoices.length,
      runningEntries: runningEntries.length,
    },
    daily: Array.from(byDay.entries()).map(([day, seconds]) => ({ day, seconds })),
    projectBreakdown: Array.from(byProject.values())
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5),
    recentEntries: [...timeEntries]
      .sort((a, b) => b.started_at - a.started_at)
      .slice(0, 6)
      .map((entry) => ({
        ...entry,
        targetName:
          projectNames.get(entry.project_id ?? '') ??
          (clientNames.get(entry.client_id ?? '') ? `${clientNames.get(entry.client_id ?? '')} (no project)` : 'Unassigned'),
      })),
    openInvoices: invoices.filter((invoice) => invoice.status !== 'paid').slice(0, 5),
  };
}

export function App() {
  const [url, setUrl] = useState(() => localStorage.getItem(bu) ?? 'http://localhost:8787');
  const [token, setToken] = useState(() => localStorage.getItem(key) ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    localStorage.setItem(bu, url);
  }, [url]);

  const save = () => {
    localStorage.setItem(key, token);
  };

  const authenticate = async (mode: 'login' | 'register') => {
    const r = await fetch(`${url}/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mode === 'register' ? { email, password, name } : { email, password }),
    });
    const j = (await r.json()) as { token?: string; error?: string };
    if (j.token) {
      setToken(j.token);
      localStorage.setItem(key, j.token);
    } else {
      alert(j.error ?? r.statusText);
    }
  };

  const me = useQuery({
    queryKey: ['me', url, token],
    enabled: !!token,
    queryFn: async () => {
      const r = await fetch(`${url}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('session expired');
      return (await r.json()) as { id: string; email: string; name: string | null };
    },
  });

  const sync = useQuery({
    queryKey: ['sync-snapshot', url, token],
    enabled: !!token && !!me.data,
    queryFn: async () => {
      const pull = await fetch(`${url}/sync/pull?since=0&device_id=web-dashboard&protocol=1`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!pull.ok) throw new Error('sync pull failed');
      return (await pull.json()) as PullResponse;
    },
  });

  const dashboard = useMemo(() => createDashboardSnapshot(sync.data), [sync.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Tickr</h1>
        <p className="text-sm text-zinc-500">
          Synced dashboard for your self-hosted API or Cloudflare Worker deployment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>Store a base URL and sign in to load the latest sync snapshot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="API base URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input
            type="password"
            placeholder="Bearer token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>Save token</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setToken('');
                localStorage.removeItem(key);
              }}
            >
              Clear token
            </Button>
            <Button variant="secondary" onClick={() => sync.refetch()} disabled={!token}>
              Refresh snapshot
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <Input placeholder="Name (for register)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => authenticate('login')}>
              Log in
            </Button>
            <Button variant="secondary" onClick={() => authenticate('register')}>
              Register
            </Button>
          </div>
        </CardContent>
      </Card>

      {me.data && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <div>
              Signed in as <span className="font-medium">{me.data.name ?? me.data.email}</span>
              <span className="text-zinc-500"> ({me.data.email})</span>
            </div>
            {sync.data && (
              <div className="text-zinc-500">Last pull: {formatDateTime(sync.data.server_now)}</div>
            )}
          </CardContent>
        </Card>
      )}

      {dashboard && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Last 7 days</CardTitle>
                <CardDescription>Total synced tracked time.</CardDescription>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatDuration(dashboard.totals.last7dSeconds, 'hm')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Today</CardTitle>
                <CardDescription>Time started today.</CardDescription>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatDuration(dashboard.totals.todaySeconds, 'hm')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Billable</CardTitle>
                <CardDescription>Across the current snapshot.</CardDescription>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatDuration(dashboard.totals.billableSeconds, 'hm')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Running entries</CardTitle>
                <CardDescription>Currently active timers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">{dashboard.counts.runningEntries}</div>
                <div className="text-sm text-zinc-500">
                  {formatDuration(dashboard.totals.activeSeconds, 'hm')} currently in flight
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity</CardTitle>
                <CardDescription>Tracked seconds grouped by day from the latest pull.</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 3600)}h`} />
                    <Tooltip formatter={(value) => formatDuration(Number(value), 'hm')} />
                    <Bar dataKey="seconds" fill="#18181b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Snapshot Health</CardTitle>
                <CardDescription>What is currently synced to this account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Clients</span>
                  <span className="font-medium">{dashboard.counts.clients}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Projects</span>
                  <span className="font-medium">{dashboard.counts.projects}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Invoices</span>
                  <span className="font-medium">{dashboard.counts.invoices}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Server time</span>
                  <span className="font-medium">{formatDateTime(dashboard.serverNow)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Entries</CardTitle>
                <CardDescription>Most recent synced sessions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.recentEntries.length === 0 ? (
                  <p className="text-sm text-zinc-500">No synced entries yet.</p>
                ) : (
                  dashboard.recentEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{entry.description || 'Untitled entry'}</div>
                        <div className="text-sm text-zinc-500">
                          {entry.targetName} · {formatDateTime(entry.started_at)}
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-sm font-medium">
                        {formatDuration(durationSeconds(entry, dashboard.serverNow), 'hm')}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Project Breakdown</CardTitle>
                <CardDescription>Top projects by tracked time.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.projectBreakdown.length === 0 ? (
                  <p className="text-sm text-zinc-500">No project data in this snapshot.</p>
                ) : (
                  dashboard.projectBreakdown.map((project) => (
                    <div key={project.name} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="font-medium">{project.name}</span>
                        </div>
                        <span>{formatDuration(project.seconds, 'hm')}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.max(
                              8,
                              (project.seconds /
                                Math.max(dashboard.projectBreakdown[0]?.seconds ?? 1, 1)) *
                                100,
                            )}%`,
                            backgroundColor: project.color,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Open Invoices</CardTitle>
              <CardDescription>Outstanding or draft invoices in the latest sync.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.openInvoices.length === 0 ? (
                <p className="text-sm text-zinc-500">No open invoices in this snapshot.</p>
              ) : (
                dashboard.openInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium">#{invoice.number}</div>
                      <div className="text-zinc-500">{invoice.status}</div>
                    </div>
                    <div className="font-medium">{formatMoney(invoice.total, invoice.currency)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
