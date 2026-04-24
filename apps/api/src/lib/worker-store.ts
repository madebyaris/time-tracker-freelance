import { nanoid, type SyncableTableName } from '@ttf/shared';
import type { ApiStore, CreateUserInput, UserRecord } from './store';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

type SyncRow = Record<string, unknown> & {
  updated_at: number;
  user_id?: string | null;
};

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  logo_data TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  default_hourly_rate_cents INTEGER,
  archived_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS clients_user_updated_idx ON clients (user_id, updated_at);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  hourly_rate INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  billable INTEGER NOT NULL DEFAULT 1,
  archived_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects (user_id, updated_at);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tags_user_updated_idx ON tags (user_id, updated_at);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  project_id TEXT,
  client_id TEXT,
  due_at INTEGER,
  completed_at INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_user_updated_idx ON tasks (user_id, updated_at);
CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks (due_at);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  client_id TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  paused_at INTEGER,
  paused_seconds INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  billable INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'timer',
  idle_discarded_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS time_entries_user_updated_idx ON time_entries (user_id, updated_at);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS entry_tags_user_updated_idx ON entry_tags (user_id, updated_at);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  number TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  due_at INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_rate INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  pdf_path TEXT,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS invoices_user_updated_idx ON invoices (user_id, updated_at);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  project_id TEXT,
  description TEXT NOT NULL,
  hours INTEGER NOT NULL,
  rate INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS invoice_lines_user_updated_idx ON invoice_lines (user_id, updated_at);

CREATE TABLE IF NOT EXISTS recurring_invoices (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  schedule_cron TEXT NOT NULL,
  template_json TEXT NOT NULL,
  next_run_at INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS recurring_invoices_user_updated_idx ON recurring_invoices (user_id, updated_at);
`;

/**
 * Each entry runs in its own try/catch so a failure in one step (e.g. column
 * already exists) doesn't prevent the others from running.
 */
const upgradeSteps: string[] = [
  `ALTER TABLE time_entries ADD COLUMN client_id TEXT;`,
  `CREATE INDEX IF NOT EXISTS time_entries_client_idx ON time_entries (client_id);`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT,
    project_id TEXT,
    client_id TEXT,
    due_at INTEGER,
    completed_at INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    device_id TEXT NOT NULL,
    user_id TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS tasks_user_updated_idx ON tasks (user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks (due_at);`,
  // ttf-002 — richer client profile
  `ALTER TABLE clients ADD COLUMN logo_data TEXT;`,
  `ALTER TABLE clients ADD COLUMN website TEXT;`,
  `ALTER TABLE clients ADD COLUMN phone TEXT;`,
  `ALTER TABLE clients ADD COLUMN address TEXT;`,
  `ALTER TABLE clients ADD COLUMN tax_id TEXT;`,
  `ALTER TABLE clients ADD COLUMN default_hourly_rate_cents INTEGER;`,
  // ttf-002 — real pause semantics on time_entries
  `ALTER TABLE time_entries ADD COLUMN paused_at INTEGER;`,
  `ALTER TABLE time_entries ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0;`,
];

const syncTableColumns: Record<SyncableTableName, readonly string[]> = {
  clients: [
    'id',
    'name',
    'email',
    'currency',
    'notes',
    'logo_data',
    'website',
    'phone',
    'address',
    'tax_id',
    'default_hourly_rate_cents',
    'archived_at',
    'updated_at',
    'deleted_at',
    'device_id',
    'user_id',
  ],
  projects: [
    'id',
    'client_id',
    'name',
    'color',
    'hourly_rate',
    'currency',
    'billable',
    'archived_at',
    'updated_at',
    'deleted_at',
    'device_id',
    'user_id',
  ],
  tags: ['id', 'name', 'color', 'updated_at', 'deleted_at', 'device_id', 'user_id'],
  tasks: [
    'id',
    'title',
    'notes',
    'project_id',
    'client_id',
    'due_at',
    'completed_at',
    'position',
    'updated_at',
    'deleted_at',
    'device_id',
    'user_id',
  ],
  time_entries: [
    'id',
    'project_id',
    'client_id',
    'started_at',
    'ended_at',
    'paused_at',
    'paused_seconds',
    'description',
    'billable',
    'source',
    'idle_discarded_seconds',
    'updated_at',
    'deleted_at',
    'device_id',
    'user_id',
  ],
  entry_tags: ['entry_id', 'tag_id', 'updated_at', 'deleted_at', 'device_id', 'user_id'],
  invoices: [
    'id',
    'client_id',
    'number',
    'issued_at',
    'due_at',
    'status',
    'currency',
    'subtotal',
    'tax_rate',
    'total',
    'notes',
    'pdf_path',
    'updated_at',
    'deleted_at',
    'device_id',
    'user_id',
  ],
  invoice_lines: [
    'id',
    'invoice_id',
    'project_id',
    'description',
    'hours',
    'rate',
    'amount',
    'position',
    'updated_at',
    'deleted_at',
    'device_id',
    'user_id',
  ],
  recurring_invoices: [
    'id',
    'client_id',
    'schedule_cron',
    'template_json',
    'next_run_at',
    'enabled',
    'updated_at',
    'deleted_at',
    'device_id',
    'user_id',
  ],
};

const primaryKeys: Record<SyncableTableName, readonly string[]> = {
  clients: ['id'],
  projects: ['id'],
  tags: ['id'],
  tasks: ['id'],
  time_entries: ['id'],
  entry_tags: ['entry_id', 'tag_id'],
  invoices: ['id'],
  invoice_lines: ['id'],
  recurring_invoices: ['id'],
};

const booleanColumns: Partial<Record<SyncableTableName, readonly string[]>> = {
  projects: ['billable'],
  time_entries: ['billable'],
  recurring_invoices: ['enabled'],
};

function shouldSkip(existing: { updated_at: number } | null, incoming: SyncRow): boolean {
  if (!existing) return false;
  return incoming.updated_at <= existing.updated_at;
}

function whereSql(columns: readonly string[]): string {
  return columns.map((column) => `${column} = ?`).join(' AND ');
}

function normalizeValue(table: SyncableTableName, column: string, value: unknown): unknown {
  if ((booleanColumns[table] ?? []).includes(column)) {
    if (value == null) return null;
    if (typeof value === 'string') {
      return value === '1' || value.toLowerCase() === 'true' ? 1 : 0;
    }
    if (typeof value === 'number') {
      return value === 0 ? 0 : 1;
    }
    return value ? 1 : 0;
  }
  return value ?? null;
}

function serializeSyncRow(
  table: SyncableTableName,
  row: Record<string, unknown>,
  userId: string,
): SyncRow {
  const next: Record<string, unknown> = { user_id: userId };
  for (const column of syncTableColumns[table]) {
    if (column === 'user_id') {
      next.user_id = userId;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      next[column] = normalizeValue(table, column, row[column]);
    }
  }
  const updatedAt = next.updated_at;
  if (typeof updatedAt !== 'number') {
    throw new Error(`Missing updated_at for ${table}`);
  }
  return next as SyncRow;
}

function deserializeSyncRow(
  table: SyncableTableName,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...row };
  for (const column of booleanColumns[table] ?? []) {
    if (column in next) {
      next[column] = Boolean(next[column]);
    }
  }
  return next;
}

async function queryAll<T>(
  db: D1DatabaseLike,
  sql: string,
  params: unknown[],
): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results ?? [];
}

async function queryFirst<T>(
  db: D1DatabaseLike,
  sql: string,
  params: unknown[],
): Promise<T | null> {
  const rows = await queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

async function run(db: D1DatabaseLike, sql: string, params: unknown[]): Promise<void> {
  await db.prepare(sql).bind(...params).run();
}

export function createWorkerStore(db: D1DatabaseLike): ApiStore {
  let ready: Promise<void> | null = null;

  return {
    async ensureReady() {
      ready ??= (async () => {
        await db.exec(schemaSql);
        for (const step of upgradeSteps) {
          try {
            await db.exec(step);
          } catch {
            // Existing databases may already have applied the step; ignore.
          }
        }
      })();
      await ready;
    },
    async getUserByEmail(email) {
      return await queryFirst<UserRecord>(
        db,
        `SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE email = ? LIMIT 1`,
        [email],
      );
    },
    async getUserById(id) {
      return await queryFirst<UserRecord>(
        db,
        `SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE id = ? LIMIT 1`,
        [id],
      );
    },
    async createUser(input: CreateUserInput) {
      const now = Date.now();
      const user: UserRecord = {
        id: nanoid(),
        email: input.email,
        name: input.name,
        password_hash: input.password_hash,
        created_at: now,
        updated_at: now,
      };
      await run(
        db,
        `INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [user.id, user.email, user.name, user.password_hash, user.created_at, user.updated_at],
      );
      return user;
    },
    async upsertSyncRow(table, row, userId) {
      const next = serializeSyncRow(table, row, userId);
      const keyColumns = primaryKeys[table];
      const keyValues = keyColumns.map((column) => {
        const value = next[column];
        if (typeof value !== 'string') {
          throw new Error(`Missing key column ${column} for ${table}`);
        }
        return value;
      });
      const existing = await queryFirst<{ updated_at: number; user_id: string | null }>(
        db,
        `SELECT updated_at, user_id FROM ${table} WHERE ${whereSql(keyColumns)} LIMIT 1`,
        keyValues,
      );
      if (existing?.user_id && existing.user_id !== userId) return;
      if (shouldSkip(existing, next)) return;

      const columns = syncTableColumns[table].filter((column) => column in next);
      const values = columns.map((column) => next[column]);

      if (existing) {
        const setSql = columns.map((column) => `${column} = ?`).join(', ');
        await run(
          db,
          `UPDATE ${table} SET ${setSql} WHERE ${whereSql(keyColumns)}`,
          [...values, ...keyValues],
        );
      } else {
        const placeholders = columns.map(() => '?').join(', ');
        await run(
          db,
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values,
        );
      }
    },
    async listSyncRows(table, userId, since) {
      const rows = await queryAll<Record<string, unknown>>(
        db,
        `SELECT ${syncTableColumns[table].join(', ')} FROM ${table} WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC`,
        [userId, since],
      );
      return rows.map((row) => deserializeSyncRow(table, row));
    },
  };
}
