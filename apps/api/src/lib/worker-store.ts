import { nanoid, type SyncableTableName } from '@ttf/shared';
import type { ApiStore, CreateUserInput, SessionRecord, UserRecord } from './store';

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
    'hourly_rate_cents_override',
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
  return {
    async countUsers() {
      const row = await queryFirst<{ value: number }>(db, `SELECT COUNT(*) AS value FROM users`, []);
      return Number(row?.value ?? 0);
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
    async createSession(input) {
      const session: SessionRecord = {
        id: nanoid(),
        user_id: input.userId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
        device_label: input.deviceLabel,
        created_at: Date.now(),
      };
      await run(
        db,
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, device_label, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.user_id,
          session.token_hash,
          session.expires_at,
          session.device_label,
          session.created_at,
        ],
      );
      return session;
    },
    async getSessionByTokenHash(tokenHash) {
      return await queryFirst<SessionRecord>(
        db,
        `SELECT id, user_id, token_hash, expires_at, device_label, created_at FROM sessions WHERE token_hash = ? LIMIT 1`,
        [tokenHash],
      );
    },
    async deleteSessionByTokenHash(tokenHash) {
      await run(db, `DELETE FROM sessions WHERE token_hash = ?`, [tokenHash]);
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
