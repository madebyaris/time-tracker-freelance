/**
 * SQL DDL applied at app startup. Applied in order; idempotent.
 * Versioning uses PRAGMA user_version.
 *
 * NOTE: When you change the schema, append a new entry — do NOT edit
 * existing ones. Migrations run inside `apps/desktop/src/db/index.ts`.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        currency TEXT NOT NULL DEFAULT 'USD',
        notes TEXT,
        archived_at INTEGER,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        device_id TEXT NOT NULL,
        user_id TEXT
      );
      CREATE INDEX IF NOT EXISTS clients_updated_idx ON clients(updated_at);

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        client_id TEXT REFERENCES clients(id),
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        hourly_rate INTEGER,
        currency TEXT NOT NULL DEFAULT 'USD',
        billable INTEGER NOT NULL DEFAULT 1,
        archived_at INTEGER,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        device_id TEXT NOT NULL,
        user_id TEXT
      );
      CREATE INDEX IF NOT EXISTS projects_client_idx ON projects(client_id);
      CREATE INDEX IF NOT EXISTS projects_updated_idx ON projects(updated_at);

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#64748b',
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        device_id TEXT NOT NULL,
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        description TEXT,
        billable INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'timer',
        idle_discarded_seconds INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        device_id TEXT NOT NULL,
        user_id TEXT
      );
      CREATE INDEX IF NOT EXISTS time_entries_project_idx ON time_entries(project_id);
      CREATE INDEX IF NOT EXISTS time_entries_started_idx ON time_entries(started_at);
      CREATE INDEX IF NOT EXISTS time_entries_updated_idx ON time_entries(updated_at);

      CREATE TABLE IF NOT EXISTS entry_tags (
        entry_id TEXT NOT NULL REFERENCES time_entries(id),
        tag_id TEXT NOT NULL REFERENCES tags(id),
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        device_id TEXT NOT NULL,
        PRIMARY KEY (entry_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        client_id TEXT REFERENCES clients(id),
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
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS invoice_lines (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id),
        project_id TEXT REFERENCES projects(id),
        description TEXT NOT NULL,
        hours INTEGER NOT NULL,
        rate INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        device_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recurring_invoices (
        id TEXT PRIMARY KEY,
        client_id TEXT REFERENCES clients(id),
        schedule_cron TEXT NOT NULL,
        template_json TEXT NOT NULL,
        next_run_at INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        device_id TEXT NOT NULL,
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'time_entries_client_id',
    sql: `
      ALTER TABLE time_entries ADD COLUMN client_id TEXT REFERENCES clients(id);
      CREATE INDEX IF NOT EXISTS time_entries_client_idx ON time_entries(client_id);
    `,
  },
  {
    version: 3,
    name: 'tasks',
    sql: `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT,
        project_id TEXT REFERENCES projects(id),
        client_id TEXT REFERENCES clients(id),
        due_at INTEGER,
        completed_at INTEGER,
        position INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        device_id TEXT NOT NULL,
        user_id TEXT
      );
      CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS tasks_client_idx ON tasks(client_id);
      CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks(due_at);
      CREATE INDEX IF NOT EXISTS tasks_updated_idx ON tasks(updated_at);
    `,
  },
  {
    version: 4,
    name: 'clients_richer_profile',
    sql: `
      ALTER TABLE clients ADD COLUMN logo_data TEXT;
      ALTER TABLE clients ADD COLUMN website TEXT;
      ALTER TABLE clients ADD COLUMN phone TEXT;
      ALTER TABLE clients ADD COLUMN address TEXT;
      ALTER TABLE clients ADD COLUMN tax_id TEXT;
      ALTER TABLE clients ADD COLUMN default_hourly_rate_cents INTEGER;
    `,
  },
  {
    version: 5,
    name: 'time_entries_paused',
    sql: `
      ALTER TABLE time_entries ADD COLUMN paused_at INTEGER;
      ALTER TABLE time_entries ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 6,
    name: 'time_entries_rate_override',
    sql: `
      ALTER TABLE time_entries ADD COLUMN hourly_rate_cents_override INTEGER;
    `,
  },
];
