import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, Field, FieldHint, FieldLabel, Input, Textarea } from '@ttf/ui';
import { Settings } from '../db/repos';
import { runSync } from '../sync/engine';
import { exportEntriesCsv } from '../lib/csv';
import { startOfDay } from '@ttf/shared';
import { encodeOwnerLogo, encodeSignature } from '../lib/encode-logo';
import {
  HIDE_DOCK_ICON_KEY,
  getShortcutInfo,
  isAutostartEnabled,
  isMacOS,
  setAutostartEnabled,
  setDockIconVisible,
  type ShortcutInfo,
} from '../lib/platform';
import { IDLE_DETECTION_ENABLED_KEY } from '../lib/idle';
import { getWidgetStatus, type WidgetStatus } from '../lib/widget-bridge';

export function SettingsView() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [idleEnabled, setIdleEnabled] = useState(true);
  const [idleSecs, setIdleSecs] = useState('300');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [ownerTaxId, setOwnerTaxId] = useState('');
  const [ownerLogo, setOwnerLogo] = useState<string | null>(null);
  const [ownerSignature, setOwnerSignature] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [status, setStatus] = useState<string>('');
  const [autostart, setAutostart] = useState(false);
  const [hideDock, setHideDock] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutInfo | null>(null);
  const [widget, setWidget] = useState<WidgetStatus | null>(null);
  const [systemError, setSystemError] = useState('');
  const macOS = isMacOS();

  useEffect(() => {
    void (async () => {
      setAutostart(await isAutostartEnabled());
      setHideDock((await Settings.get(HIDE_DOCK_ICON_KEY)) === '1');
      setShortcuts(await getShortcutInfo());
      setWidget(await getWidgetStatus());
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setUrl((await Settings.get('backend_url')) ?? '');
      setToken((await Settings.get('backend_token')) ?? '');
      setIdleEnabled((await Settings.get(IDLE_DETECTION_ENABLED_KEY)) !== '0');
      setIdleSecs((await Settings.get('idle_threshold_secs')) ?? '300');
      setOwnerName((await Settings.get('owner_name')) ?? '');
      setOwnerEmail((await Settings.get('owner_email')) ?? '');
      setOwnerAddress((await Settings.get('owner_address')) ?? '');
      setOwnerTaxId((await Settings.get('owner_tax_id')) ?? '');
      setOwnerLogo((await Settings.get('owner_logo_data')) ?? null);
      setOwnerSignature((await Settings.get('owner_signature_data')) ?? null);
      setPaymentInstructions((await Settings.get('owner_payment_instructions')) ?? '');
    })();
  }, []);

  async function save() {
    await Settings.set('backend_url', url.trim());
    await Settings.set('backend_token', token.trim());
    await Settings.set(IDLE_DETECTION_ENABLED_KEY, idleEnabled ? '1' : '0');
    await Settings.set('idle_threshold_secs', idleSecs);
    await Settings.set('owner_name', ownerName.trim());
    await Settings.set('owner_email', ownerEmail.trim());
    await Settings.set('owner_address', ownerAddress.trim());
    await Settings.set('owner_tax_id', ownerTaxId.trim());
    await Settings.set('owner_logo_data', ownerLogo ?? '');
    await Settings.set('owner_signature_data', ownerSignature ?? '');
    await Settings.set('owner_payment_instructions', paymentInstructions.trim());
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

  // These two write straight through rather than waiting for Save — they change
  // OS-level state, so a pending "unsaved" toggle would misrepresent reality.
  async function toggleAutostart(next: boolean) {
    setSystemError('');
    try {
      await setAutostartEnabled(next);
      setAutostart(next);
    } catch (e) {
      setSystemError(`Couldn't ${next ? 'enable' : 'disable'} launch at login: ${(e as Error).message}`);
    }
  }

  async function toggleHideDock(next: boolean) {
    setSystemError('');
    try {
      await setDockIconVisible(!next);
      await Settings.set(HIDE_DOCK_ICON_KEY, next ? '1' : '0');
      setHideDock(next);
    } catch (e) {
      setSystemError(`Couldn't change the Dock icon: ${(e as Error).message}`);
    }
  }

  async function toggleIdleDetection(next: boolean) {
    setIdleEnabled(next);
    await Settings.set(IDLE_DETECTION_ENABLED_KEY, next ? '1' : '0');
  }

  async function exportAll() {
    const start = startOfDay(Date.now() - 365 * 86_400_000);
    const end = Date.now() + 86_400_000;
    const path = await exportEntriesCsv({ from: start, to: end, fileLabel: 'all' });
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
        title="Invoice profile"
        description="Appears as the “from” block, header, and signature on every invoice PDF."
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
        <Field>
          <FieldLabel>Address</FieldLabel>
          <Textarea
            rows={3}
            placeholder={`Street line 1\nCity, Region ZIP\nCountry`}
            value={ownerAddress}
            onChange={(e) => setOwnerAddress(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>Tax ID / VAT number</FieldLabel>
          <Input
            placeholder="e.g. NPWP 00.000.000.0-000.000"
            value={ownerTaxId}
            onChange={(e) => setOwnerTaxId(e.target.value)}
          />
        </Field>

        <ImageUploadField
          label="Logo"
          hint="PNG, JPEG, or WebP. Rendered up to 56×56 on the invoice header."
          value={ownerLogo}
          onChange={setOwnerLogo}
          kind="logo"
        />

        <ImageUploadField
          label="Signature"
          hint="Transparent PNG works best. Shown above your printed name on invoices."
          value={ownerSignature}
          onChange={setOwnerSignature}
          kind="signature"
        />

        <Field>
          <FieldLabel>Payment instructions</FieldLabel>
          <Textarea
            rows={4}
            placeholder={`Bank: ACME Bank\nAccount name: Your Name\nAccount #: 0000-0000-0000\nIBAN / SWIFT / routing: …`}
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
          />
          <FieldHint>
            Shown near the total on every invoice PDF. Use plain text; keep it short.
          </FieldHint>
        </Field>
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
        description="When a timer is running and you stop using the computer, Tickr discards that idle window from the entry and notifies you."
      >
        <ToggleField
          label="Detect idle time"
          hint="Turn off if you leave timers running during meetings, reading, or other work that does not move the mouse or keyboard."
          checked={idleEnabled}
          onChange={toggleIdleDetection}
        />
        <Field>
          <FieldLabel>Threshold (seconds)</FieldLabel>
          <Input
            type="number"
            min="60"
            value={idleSecs}
            onChange={(e) => setIdleSecs(e.target.value)}
            disabled={!idleEnabled}
          />
          <FieldHint>
            How long without input before the idle window is discarded. Takes effect after Save.
          </FieldHint>
        </Field>
      </SettingsGroup>

      <SettingsGroup
        title="System"
        description="Startup behaviour, window chrome, and the global shortcuts Tickr claimed."
      >
        <ToggleField
          label="Launch at login"
          hint="Starts Tickr in the tray when you log in."
          checked={autostart}
          onChange={toggleAutostart}
        />

        {macOS && (
          <ToggleField
            label="Hide Dock icon"
            hint="Runs Tickr from the menu bar only. It also disappears from Cmd-Tab, and the icon still flashes briefly at launch."
            checked={hideDock}
            onChange={toggleHideDock}
          />
        )}

        {systemError && <span className="text-xs text-red-600">{systemError}</span>}

        {shortcuts && (
          <Field>
            <FieldLabel>Global shortcuts</FieldLabel>
            <div className="flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              <ShortcutRow label="Start / stop timer" accelerator={shortcuts.toggleTimer} />
              <ShortcutRow label="Quick panel" accelerator={shortcuts.quickPanel} />
            </div>
            {shortcuts.issues.length > 0 ? (
              <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="font-medium">Some shortcuts could not be registered</div>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {shortcuts.issues.map((issue) => (
                    <li key={issue.action}>
                      {issue.action} ({issue.accelerator}) — {issue.error}. Another app is probably
                      using it.
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <FieldHint>Both shortcuts registered. Restart Tickr if one stops responding.</FieldHint>
            )}
          </Field>
        )}
      </SettingsGroup>

      {widget?.supported && (
        <SettingsGroup
          title="Desktop widget"
          description="A read-only view of the running timer and today's totals, on the macOS desktop or in Notification Center."
        >
          {widget.embedded ? (
            <FieldHint>
              The widget is bundled with this build. macOS only offers widgets from apps installed
              in <strong>/Applications</strong>, so move Tickr there and launch it once, then
              right-click the desktop and choose Edit Widgets to add it. Requires macOS 14 or later.
            </FieldHint>
          ) : (
            <FieldHint>
              No widget extension in this build — that is expected during{' '}
              <code>tauri dev</code>, which produces no app bundle. Run a packaged build to get it.
            </FieldHint>
          )}
        </SettingsGroup>
      )}

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

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void | Promise<void>;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
          checked={checked}
          onChange={(event) => void onChange(event.target.checked)}
        />
        {hint && <span>{hint}</span>}
      </label>
    </Field>
  );
}

function ShortcutRow({ label, accelerator }: { label: string; accelerator: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <kbd className="rounded border border-zinc-300/70 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {accelerator || '—'}
      </kbd>
    </div>
  );
}

interface ImageUploadFieldProps {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (next: string | null) => void;
  kind: 'logo' | 'signature';
}

function ImageUploadField({ label, hint, value, onChange, kind }: ImageUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [encoding, setEncoding] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setEncoding(true);
    try {
      const result = kind === 'signature' ? await encodeSignature(file) : await encodeOwnerLogo(file);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      onChange(result.dataUrl);
    } finally {
      setEncoding(false);
    }
  }

  const previewBackground =
    kind === 'signature'
      ? 'bg-[conic-gradient(at_10%_10%,#f4f4f5,white_25%,#f4f4f5_50%,white_75%,#f4f4f5)] dark:bg-zinc-950/40'
      : 'bg-zinc-50 dark:bg-zinc-950/40';

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-20 w-32 items-center justify-center overflow-hidden rounded-md border border-dashed border-zinc-300 ${previewBackground} dark:border-zinc-700`}
        >
          {value ? (
            <img src={value} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              No {label.toLowerCase()}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFile}
          />
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={encoding}
            >
              {encoding ? 'Encoding…' : value ? 'Replace' : 'Upload'}
            </Button>
            {value && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
                disabled={encoding}
              >
                Remove
              </Button>
            )}
          </div>
          {error && <span className="text-xs text-red-600">{error}</span>}
          {hint && !error && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
          )}
        </div>
      </div>
    </Field>
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
