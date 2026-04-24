import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@ttf/ui';
import { formatDuration, startOfDay } from '@ttf/shared';

const key = 'ttf_web_token';
const bu = 'ttf_base_url';

export function App() {
  const [url, setUrl] = useState(() => localStorage.getItem(bu) ?? 'http://localhost:8787');
  const [token, setToken] = useState(() => localStorage.getItem(key) ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    localStorage.setItem(bu, url);
  }, [url]);

  const save = () => {
    localStorage.setItem(key, token);
  };

  const login = async () => {
    const r = await fetch(`${url}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
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

  const from = startOfDay(Date.now() - 6 * 86_400_000);
  const to = startOfDay(Date.now()) + 86_400_000;

  const report = useQuery({
    queryKey: ['sum', from, to, url, token],
    enabled: !!token && !!me.data,
    queryFn: async () => {
      const push = await fetch(`${url}/sync/pull?since=0&device_id=web&protocol=1`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!push.ok) throw new Error('pull failed');
      const d = (await push.json()) as { batches: { table: string; rows: { started_at?: number; ended_at?: number }[] }[] };
      const entries = d.batches.find((b) => b.table === 'time_entries')?.rows ?? [];
      let sec = 0;
      for (const e of entries) {
        if (e.started_at && e.ended_at) sec += (e.ended_at - e.started_at) / 1000;
      }
      return { seconds: sec, n: entries.length };
    },
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-bold">Tickr</h1>
      <p className="text-sm text-zinc-500">Read-only view of data synced to your self-hosted API.</p>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="API base URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input
            type="password"
            placeholder="Bearer token (paste from login or desktop)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <Button onClick={save}>Save</Button>
          <div className="flex gap-2">
            <Input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button variant="secondary" onClick={login}>
              Log in
            </Button>
          </div>
        </CardContent>
      </Card>

      {me.data && (
        <Card>
          <CardContent className="p-4 text-sm">Signed in as {me.data.email}</CardContent>
        </Card>
      )}

      {report.data && (
        <Card>
          <CardHeader>
            <CardTitle>Last 7d (pulled from server)</CardTitle>
          </CardHeader>
          <CardContent>
            {formatDuration(report.data.seconds)} across {report.data.n} entries
          </CardContent>
        </Card>
      )}
    </div>
  );
}
