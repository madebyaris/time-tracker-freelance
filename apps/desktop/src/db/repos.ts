import { nanoid } from '@ttf/shared';
import { exec, query } from './index';
import { getDeviceId } from '../lib/device';

const now = () => Date.now();

export interface Client {
  id: string;
  name: string;
  email: string | null;
  currency: string;
  notes: string | null;
  // ttf-002: richer client profile
  logo_data: string | null; // data:image/webp;base64,…
  website: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  default_hourly_rate_cents: number | null;
  archived_at: number | null;
  updated_at: number;
  deleted_at: number | null;
  device_id: string;
}

export interface Project {
  id: string;
  client_id: string | null;
  name: string;
  color: string;
  hourly_rate: number | null;
  currency: string;
  billable: number; // SQLite stores boolean as 0/1
  archived_at: number | null;
  updated_at: number;
  deleted_at: number | null;
  device_id: string;
}

export interface TimeEntry {
  id: string;
  project_id: string | null;
  client_id: string | null;
  started_at: number;
  ended_at: number | null;
  // ttf-002: real pause semantics. While paused, `paused_at` is set and the
  // entry stays open. On resume the elapsed pause is folded into
  // `paused_seconds`; on stop any active pause is folded too.
  paused_at: number | null;
  paused_seconds: number;
  description: string | null;
  billable: number;
  source: 'manual' | 'timer' | 'pomodoro' | 'calendar';
  idle_discarded_seconds: number;
  updated_at: number;
  deleted_at: number | null;
  device_id: string;
}

// ---------- Clients ----------

export const Clients = {
  async list(): Promise<Client[]> {
    return query<Client>(
      `SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY archived_at IS NULL DESC, name`,
    );
  },
  async create(input: {
    name: string;
    email?: string | null;
    currency?: string;
    logo_data?: string | null;
    website?: string | null;
    phone?: string | null;
    address?: string | null;
    tax_id?: string | null;
    default_hourly_rate_cents?: number | null;
    notes?: string | null;
  }): Promise<Client> {
    const id = nanoid();
    const device_id = await getDeviceId();
    const ts = now();
    await exec(
      `INSERT INTO clients (
         id, name, email, currency, notes,
         logo_data, website, phone, address, tax_id, default_hourly_rate_cents,
         updated_at, device_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.email ?? null,
        input.currency ?? 'USD',
        input.notes ?? null,
        input.logo_data ?? null,
        input.website ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.tax_id ?? null,
        input.default_hourly_rate_cents ?? null,
        ts,
        device_id,
      ],
    );
    return (await this.get(id))!;
  },
  async get(id: string): Promise<Client | null> {
    const rows = await query<Client>(`SELECT * FROM clients WHERE id = ?`, [id]);
    return rows[0] ?? null;
  },
  async update(
    id: string,
    patch: Partial<
      Pick<
        Client,
        | 'name'
        | 'email'
        | 'currency'
        | 'notes'
        | 'logo_data'
        | 'website'
        | 'phone'
        | 'address'
        | 'tax_id'
        | 'default_hourly_rate_cents'
      >
    >,
  ) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    sets.push('updated_at = ?');
    vals.push(now());
    vals.push(id);
    await exec(`UPDATE clients SET ${sets.join(', ')} WHERE id = ?`, vals);
  },
  async softDelete(id: string) {
    await exec(`UPDATE clients SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
      now(),
      now(),
      id,
    ]);
  },
};

// ---------- Projects ----------

export const Projects = {
  async list(opts: { includeArchived?: boolean } = {}): Promise<Project[]> {
    const where = opts.includeArchived
      ? `WHERE deleted_at IS NULL`
      : `WHERE deleted_at IS NULL AND archived_at IS NULL`;
    return query<Project>(`SELECT * FROM projects ${where} ORDER BY name`);
  },
  async create(input: {
    name: string;
    client_id?: string | null;
    color?: string;
    hourly_rate?: number | null;
    currency?: string;
    billable?: boolean;
  }): Promise<Project> {
    const id = nanoid();
    const device_id = await getDeviceId();
    const ts = now();
    await exec(
      `INSERT INTO projects (id, client_id, name, color, hourly_rate, currency, billable, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.client_id ?? null,
        input.name,
        input.color ?? '#3b82f6',
        input.hourly_rate ?? null,
        input.currency ?? 'USD',
        input.billable === false ? 0 : 1,
        ts,
        device_id,
      ],
    );
    return (await this.get(id))!;
  },
  async get(id: string): Promise<Project | null> {
    const rows = await query<Project>(`SELECT * FROM projects WHERE id = ?`, [id]);
    return rows[0] ?? null;
  },
  async update(
    id: string,
    patch: Partial<
      Pick<Project, 'name' | 'client_id' | 'color' | 'hourly_rate' | 'currency'> & {
        billable: boolean;
        archived: boolean;
      }
    >,
  ) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'billable') {
        sets.push('billable = ?');
        vals.push(v ? 1 : 0);
      } else if (k === 'archived') {
        sets.push('archived_at = ?');
        vals.push(v ? now() : null);
      } else {
        sets.push(`${k} = ?`);
        vals.push(v);
      }
    }
    sets.push('updated_at = ?');
    vals.push(now());
    vals.push(id);
    await exec(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, vals);
  },
  async softDelete(id: string) {
    await exec(`UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
      now(),
      now(),
      id,
    ]);
  },
};

// ---------- Tasks ----------

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  project_id: string | null;
  client_id: string | null;
  due_at: number | null;
  completed_at: number | null;
  position: number;
  updated_at: number;
  deleted_at: number | null;
  device_id: string;
}

export const Tasks = {
  async list(opts: { includeCompleted?: boolean } = {}): Promise<Task[]> {
    const where = opts.includeCompleted
      ? `WHERE deleted_at IS NULL`
      : `WHERE deleted_at IS NULL AND completed_at IS NULL`;
    return query<Task>(
      `SELECT * FROM tasks ${where}
       ORDER BY
         completed_at IS NOT NULL,
         CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
         due_at,
         position,
         updated_at DESC`,
    );
  },
  async get(id: string): Promise<Task | null> {
    const rows = await query<Task>(`SELECT * FROM tasks WHERE id = ?`, [id]);
    return rows[0] ?? null;
  },
  async create(input: {
    title: string;
    notes?: string | null;
    project_id?: string | null;
    client_id?: string | null;
    due_at?: number | null;
  }): Promise<Task> {
    const id = nanoid();
    const device_id = await getDeviceId();
    const ts = now();
    await exec(
      `INSERT INTO tasks (id, title, notes, project_id, client_id, due_at, position, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.title,
        input.notes ?? null,
        input.project_id ?? null,
        input.client_id ?? null,
        input.due_at ?? null,
        ts, // use timestamp as initial position so newly added tasks land at the bottom of equal-due groups
        ts,
        device_id,
      ],
    );
    return (await this.get(id))!;
  },
  async update(
    id: string,
    patch: Partial<
      Pick<Task, 'title' | 'notes' | 'project_id' | 'client_id' | 'due_at' | 'position'>
    >,
  ) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    sets.push('updated_at = ?');
    vals.push(now());
    vals.push(id);
    await exec(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, vals);
  },
  async setCompleted(id: string, completed: boolean) {
    await exec(
      `UPDATE tasks SET completed_at = ?, updated_at = ? WHERE id = ?`,
      [completed ? now() : null, now(), id],
    );
  },
  async softDelete(id: string) {
    await exec(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
      now(),
      now(),
      id,
    ]);
  },
};

// ---------- Time entries ----------

export const TimeEntries = {
  async list(opts: { from?: number; to?: number; projectId?: string | null } = {}): Promise<
    TimeEntry[]
  > {
    const where: string[] = ['deleted_at IS NULL'];
    const vals: unknown[] = [];
    if (opts.from !== undefined) {
      where.push('started_at >= ?');
      vals.push(opts.from);
    }
    if (opts.to !== undefined) {
      where.push('started_at < ?');
      vals.push(opts.to);
    }
    if (opts.projectId) {
      where.push('project_id = ?');
      vals.push(opts.projectId);
    }
    return query<TimeEntry>(
      `SELECT * FROM time_entries WHERE ${where.join(' AND ')} ORDER BY started_at DESC`,
      vals,
    );
  },
  /** Returns the currently running entry, if any. */
  async getRunning(): Promise<TimeEntry | null> {
    const rows = await query<TimeEntry>(
      `SELECT * FROM time_entries WHERE ended_at IS NULL AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  },
  async start(input: {
    project_id?: string | null;
    client_id?: string | null;
    description?: string | null;
    billable?: boolean;
    source?: 'manual' | 'timer' | 'pomodoro' | 'calendar';
  }): Promise<TimeEntry> {
    // Stop any running timer first; only one active entry at a time.
    const running = await this.getRunning();
    if (running) await this.stop(running.id);
    const id = nanoid();
    const device_id = await getDeviceId();
    const ts = now();
    await exec(
      `INSERT INTO time_entries (id, project_id, client_id, started_at, description, billable, source, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.project_id ?? null,
        input.client_id ?? null,
        ts,
        input.description ?? null,
        input.billable === false ? 0 : 1,
        input.source ?? 'timer',
        ts,
        device_id,
      ],
    );
    return (await this.get(id))!;
  },
  /**
   * Stop a time entry. If it was paused, the in-progress pause is folded
   * into `paused_seconds` so the entry's effective duration is correct
   * regardless of how long it sat paused.
   */
  async stop(id: string, endedAt: number = now()) {
    const entry = await this.get(id);
    if (!entry) return;
    const extraPausedMs = entry.paused_at ? Math.max(0, endedAt - entry.paused_at) : 0;
    const pausedSeconds = entry.paused_seconds + Math.floor(extraPausedMs / 1000);
    await exec(
      `UPDATE time_entries SET ended_at = ?, paused_at = NULL, paused_seconds = ?, updated_at = ? WHERE id = ?`,
      [endedAt, pausedSeconds, now(), id],
    );
  },
  /** Pause the running entry (entry stays open, ended_at remains null). */
  async pause(id: string, pausedAt: number = now()) {
    await exec(
      `UPDATE time_entries SET paused_at = ?, updated_at = ? WHERE id = ? AND ended_at IS NULL AND paused_at IS NULL`,
      [pausedAt, now(), id],
    );
  },
  /** Resume a paused entry. Folds the elapsed pause into `paused_seconds`. */
  async resume(id: string, resumedAt: number = now()) {
    const entry = await this.get(id);
    if (!entry || entry.paused_at == null) return;
    const extraPausedMs = Math.max(0, resumedAt - entry.paused_at);
    const pausedSeconds = entry.paused_seconds + Math.floor(extraPausedMs / 1000);
    await exec(
      `UPDATE time_entries SET paused_at = NULL, paused_seconds = ?, updated_at = ? WHERE id = ?`,
      [pausedSeconds, now(), id],
    );
  },
  async get(id: string): Promise<TimeEntry | null> {
    const rows = await query<TimeEntry>(`SELECT * FROM time_entries WHERE id = ?`, [id]);
    return rows[0] ?? null;
  },
  async update(
    id: string,
    patch: Partial<
      Pick<
        TimeEntry,
        | 'project_id'
        | 'client_id'
        | 'started_at'
        | 'ended_at'
        | 'description'
        | 'idle_discarded_seconds'
      > & { billable: boolean }
    >,
  ) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'billable') {
        sets.push('billable = ?');
        vals.push(v ? 1 : 0);
      } else {
        sets.push(`${k} = ?`);
        vals.push(v);
      }
    }
    sets.push('updated_at = ?');
    vals.push(now());
    vals.push(id);
    await exec(`UPDATE time_entries SET ${sets.join(', ')} WHERE id = ?`, vals);
  },
  async createManual(input: {
    project_id?: string | null;
    client_id?: string | null;
    started_at: number;
    ended_at: number;
    description?: string | null;
  }): Promise<TimeEntry> {
    const id = nanoid();
    const device_id = await getDeviceId();
    const ts = now();
    await exec(
      `INSERT INTO time_entries (id, project_id, client_id, started_at, ended_at, description, source, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
      [
        id,
        input.project_id ?? null,
        input.client_id ?? null,
        input.started_at,
        input.ended_at,
        input.description ?? null,
        ts,
        device_id,
      ],
    );
    return (await this.get(id))!;
  },
  async softDelete(id: string) {
    await exec(`UPDATE time_entries SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
      now(),
      now(),
      id,
    ]);
  },
  /**
   * Entries for a client in [from, to). Includes both:
   *  - entries directly attached to the client (no project)
   *  - entries on any project that belongs to the client
   */
  async listForClientRange(clientId: string, from: number, to: number): Promise<TimeEntry[]> {
    return query<TimeEntry>(
      `SELECT e.* FROM time_entries e
       LEFT JOIN projects p ON e.project_id = p.id
       WHERE e.deleted_at IS NULL
         AND e.started_at >= ? AND e.started_at < ?
         AND (e.client_id = ? OR p.client_id = ?)`,
      [from, to, clientId, clientId],
    );
  },
};

// ---------- Invoices (local PDF path; full sync on backend) ----------

export interface Invoice {
  id: string;
  client_id: string | null;
  number: string;
  issued_at: number;
  due_at: number | null;
  status: string;
  currency: string;
  subtotal: number;
  tax_rate: number;
  total: number;
  notes: string | null;
  pdf_path: string | null;
  updated_at: number;
  deleted_at: number | null;
  device_id: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  project_id: string | null;
  description: string;
  hours: number;
  rate: number;
  amount: number;
  position: number;
  updated_at: number;
  deleted_at: number | null;
  device_id: string;
}

export const Invoices = {
  async list(): Promise<Invoice[]> {
    return query<Invoice>(
      `SELECT * FROM invoices WHERE deleted_at IS NULL ORDER BY issued_at DESC`,
    );
  },
  async get(id: string): Promise<Invoice | null> {
    const rows = await query<Invoice>(`SELECT * FROM invoices WHERE id = ?`, [id]);
    return rows[0] ?? null;
  },
  async nextNumber(): Promise<string> {
    const rows = await query<{ c: number }>(`SELECT COUNT(*) as c FROM invoices`);
    const n = (rows[0]?.c ?? 0) + 1;
    return `INV-${String(n).padStart(5, '0')}`;
  },
  async createWithLines(input: {
    client_id: string;
    number: string;
    issued_at: number;
    due_at: number | null;
    currency: string;
    subtotal: number;
    tax_rate: number;
    total: number;
    notes: string | null;
    lines: Array<{
      project_id: string | null;
      description: string;
      hours: number;
      rate: number;
      amount: number;
    }>;
  }): Promise<Invoice> {
    const invId = nanoid();
    const device_id = await getDeviceId();
    const ts = now();
    await exec(
      `INSERT INTO invoices (id, client_id, number, issued_at, due_at, status, currency, subtotal, tax_rate, total, notes, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
      [
        invId,
        input.client_id,
        input.number,
        input.issued_at,
        input.due_at,
        input.currency,
        input.subtotal,
        input.tax_rate,
        input.total,
        input.notes,
        ts,
        device_id,
      ],
    );
    let pos = 0;
    for (const line of input.lines) {
      const lineId = nanoid();
      await exec(
        `INSERT INTO invoice_lines (id, invoice_id, project_id, description, hours, rate, amount, position, updated_at, device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lineId,
          invId,
          line.project_id,
          line.description,
          line.hours,
          line.rate,
          line.amount,
          pos++,
          ts,
          device_id,
        ],
      );
    }
    return (await this.get(invId))!;
  },
  async setPdfPath(id: string, path: string) {
    await exec(`UPDATE invoices SET pdf_path = ?, updated_at = ? WHERE id = ?`, [path, now(), id]);
  },
  async listLines(invoiceId: string): Promise<InvoiceLine[]> {
    return query<InvoiceLine>(
      `SELECT * FROM invoice_lines WHERE invoice_id = ? AND deleted_at IS NULL ORDER BY position`,
      [invoiceId],
    );
  },
};

// ---------- Settings (local only) ----------

export const Settings = {
  async get(key: string): Promise<string | null> {
    const rows = await query<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [key]);
    return rows[0]?.value ?? null;
  },
  async set(key: string, value: string): Promise<void> {
    await exec(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  },
};
