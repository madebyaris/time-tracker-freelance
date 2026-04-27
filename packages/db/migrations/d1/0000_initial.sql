-- Tickr D1 schema for Cloudflare Worker deployments.
-- Mirrors the sync surface used by apps/api/src/lib/worker-store.ts.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  device_label TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

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
CREATE INDEX IF NOT EXISTS projects_client_idx ON projects (client_id);

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
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_client_idx ON tasks (client_id);
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
CREATE INDEX IF NOT EXISTS time_entries_project_idx ON time_entries (project_id);
CREATE INDEX IF NOT EXISTS time_entries_client_idx ON time_entries (client_id);
CREATE INDEX IF NOT EXISTS time_entries_started_idx ON time_entries (started_at);

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
CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_issued_idx ON invoices (issued_at);

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
CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON invoice_lines (invoice_id);

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
