import { useEffect, useState } from 'react';
import { Button, Field, FieldHint, FieldLabel, Input } from '@ttf/ui';
import { Settings } from '../db/repos';
import { runSync } from '../sync/engine';
import { exportEntriesCsv } from '../lib/csv';
import { startOfDay } from '@ttf/shared';

export function SettingsView() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [idleSecs, setIdleSecs] = useState('300');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    void (async () => {
      setUrl((await Settings.get('backend_url')) ?? '');
      setToken((await Settings.get('backend_token')) ?? '');
      setIdleSecs((await Settings.get('idle_threshold_secs')) ?? '300');
      setOwnerName((await Settings.get('owner_name')) ?? '');
      setOwnerEmail((await Settings.get('owner_email')) ?? '');
    })();
  }, []);

  async function save() {
    await Settings.set('backend_url', url.trim());
    await Settings.set('backend_token', token.trim());
    await Settings.set('idle_threshold_secs', idleSecs);
    await Settings.set('owner_name', ownerName.trim());
    await Settings.set('owner_email', ownerEmail.trim());
    setStatus('Saved ✓');
    setTimeout(() => setStatus(''), 1500);
  }

  async function testSync() {
    setStatus('Syncing…');
    try {
      await runSync();
      setStatus('Sync OK ✓');
    } catch (e) {
      setStatus(`Sync failed: ${(e as Error).message}`);
    }
  }

  async function exportAll() {
    const start = startOfDay(Date.now() - 365 * 86_400_000);
    const end = Date.now() + 86_400_000;
    const path = await exportEntriesCsv({ from: start, to: end });
    if (path) setStatus(`Exported to ${path}`);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header>
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Settings
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Preferences</h1>
      </header>

      <SettingsGroup
        title="Your details"
        description="Used as the “from” block on invoices."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Name or business</FieldLabel>
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </Field>
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Sync"
        description="Tickr works offline by default. Connect a backend to sync across devices."
      >
        <Field>
          <FieldLabel>Backend URL</FieldLabel>
          <Input
            placeholder="https://api.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>API token</FieldLabel>
          <Input
            type="password"
            placeholder="••••••••"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testSync}>
            Test sync
          </Button>
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Idle detection"
        description="Pause tracking suggestions after this many seconds of no input."
      >
        <Field>
          <FieldLabel>Threshold (seconds)</FieldLabel>
          <Input
            type="number"
            min="60"
            value={idleSecs}
            onChange={(e) => setIdleSecs(e.target.value)}
          />
        </Field>
      </SettingsGroup>

      <SettingsGroup title="Export" description="Spreadsheet-friendly CSV of every tracked entry.">
        <div>
          <Button variant="outline" onClick={exportAll}>
            Export all entries to CSV
          </Button>
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Native integrations"
        description="App tracking and Calendar import bridges land in upcoming releases."
      >
        <FieldHint>
          App and window auto-tracking, Calendar import (EventKit / Google) and the related macOS
          entitlements are stubbed in the shell.
        </FieldHint>
      </SettingsGroup>

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50/95 px-1 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{status}</span>
        <Button variant="primary" onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
