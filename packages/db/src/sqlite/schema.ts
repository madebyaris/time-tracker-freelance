import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema — used by the desktop app's local DB and by Cloudflare D1.
 * IDs are nanoid strings (not autoincrement) so they sync without remap.
 * Timestamps are unix epoch ms stored as INTEGER.
 */

export const clients = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email'),
    currency: text('currency').notNull().default('USD'),
    notes: text('notes'),
    // ttf-002: richer client profile
    logo_data: text('logo_data'), // data:image/webp;base64,… (≤ 64 KB)
    website: text('website'),
    phone: text('phone'),
    address: text('address'),
    tax_id: text('tax_id'),
    default_hourly_rate_cents: integer('default_hourly_rate_cents'),
    archived_at: integer('archived_at'),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
    device_id: text('device_id').notNull(),
    user_id: text('user_id'), // null in local-only mode
  },
  (t) => ({
    updatedIdx: index('clients_updated_idx').on(t.updated_at),
    userIdx: index('clients_user_idx').on(t.user_id),
  }),
);

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').references(() => clients.id),
    name: text('name').notNull(),
    color: text('color').notNull().default('#3b82f6'),
    hourly_rate: integer('hourly_rate'), // minor units (cents)
    currency: text('currency').notNull().default('USD'),
    billable: integer('billable', { mode: 'boolean' }).notNull().default(true),
    archived_at: integer('archived_at'),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
    device_id: text('device_id').notNull(),
    user_id: text('user_id'),
  },
  (t) => ({
    clientIdx: index('projects_client_idx').on(t.client_id),
    updatedIdx: index('projects_updated_idx').on(t.updated_at),
  }),
);

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#64748b'),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
  device_id: text('device_id').notNull(),
  user_id: text('user_id'),
});

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    notes: text('notes'),
    project_id: text('project_id').references(() => projects.id),
    client_id: text('client_id').references(() => clients.id),
    due_at: integer('due_at'), // unix epoch ms; null = no due date
    completed_at: integer('completed_at'),
    position: integer('position').notNull().default(0),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
    device_id: text('device_id').notNull(),
    user_id: text('user_id'),
  },
  (t) => ({
    projectIdx: index('tasks_project_idx').on(t.project_id),
    clientIdx: index('tasks_client_idx').on(t.client_id),
    dueIdx: index('tasks_due_idx').on(t.due_at),
    updatedIdx: index('tasks_updated_idx').on(t.updated_at),
  }),
);

export const time_entries = sqliteTable(
  'time_entries',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id').references(() => projects.id),
    client_id: text('client_id').references(() => clients.id),
    started_at: integer('started_at').notNull(),
    ended_at: integer('ended_at'), // null = currently running
    // ttf-002: real pause semantics. While paused, `paused_at` is set
    // (entry stays open). On resume, the elapsed pause is folded into
    // `paused_seconds`. On stop, any active pause is folded too.
    paused_at: integer('paused_at'),
    paused_seconds: integer('paused_seconds').notNull().default(0),
    description: text('description'),
    billable: integer('billable', { mode: 'boolean' }).notNull().default(true),
    source: text('source', { enum: ['manual', 'timer', 'pomodoro', 'calendar'] })
      .notNull()
      .default('timer'),
    idle_discarded_seconds: integer('idle_discarded_seconds').notNull().default(0),
    // Per-entry hourly rate override (cents/hour). When set, beats project
    // and client default rates for revenue/invoice calculations.
    hourly_rate_cents_override: integer('hourly_rate_cents_override'),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
    device_id: text('device_id').notNull(),
    user_id: text('user_id'),
  },
  (t) => ({
    projectIdx: index('time_entries_project_idx').on(t.project_id),
    clientIdx: index('time_entries_client_idx').on(t.client_id),
    startedIdx: index('time_entries_started_idx').on(t.started_at),
    updatedIdx: index('time_entries_updated_idx').on(t.updated_at),
  }),
);

export const entry_tags = sqliteTable(
  'entry_tags',
  {
    entry_id: text('entry_id')
      .notNull()
      .references(() => time_entries.id),
    tag_id: text('tag_id')
      .notNull()
      .references(() => tags.id),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
    device_id: text('device_id').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entry_id, t.tag_id] }),
  }),
);

export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id').references(() => clients.id),
    number: text('number').notNull(),
    issued_at: integer('issued_at').notNull(),
    due_at: integer('due_at'),
    status: text('status', { enum: ['draft', 'sent', 'paid', 'overdue', 'void'] })
      .notNull()
      .default('draft'),
    currency: text('currency').notNull().default('USD'),
    subtotal: integer('subtotal').notNull().default(0), // cents
    tax_rate: integer('tax_rate').notNull().default(0), // basis points (1234 = 12.34%)
    total: integer('total').notNull().default(0), // cents
    notes: text('notes'),
    pdf_path: text('pdf_path'),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
    device_id: text('device_id').notNull(),
    user_id: text('user_id'),
  },
  (t) => ({
    clientIdx: index('invoices_client_idx').on(t.client_id),
    issuedIdx: index('invoices_issued_idx').on(t.issued_at),
  }),
);

export const invoice_lines = sqliteTable('invoice_lines', {
  id: text('id').primaryKey(),
  invoice_id: text('invoice_id')
    .notNull()
    .references(() => invoices.id),
  project_id: text('project_id').references(() => projects.id),
  description: text('description').notNull(),
  hours: integer('hours').notNull(), // hundredths (1.50h = 150)
  rate: integer('rate').notNull(), // cents
  amount: integer('amount').notNull(), // cents
  position: integer('position').notNull().default(0),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
  device_id: text('device_id').notNull(),
});

export const recurring_invoices = sqliteTable('recurring_invoices', {
  id: text('id').primaryKey(),
  client_id: text('client_id').references(() => clients.id),
  schedule_cron: text('schedule_cron').notNull(),
  template_json: text('template_json').notNull(),
  next_run_at: integer('next_run_at'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
  device_id: text('device_id').notNull(),
  user_id: text('user_id'),
});

/**
 * Local-only on the desktop. Holds preferences, sync cursor, device id, etc.
 * Not synced to backend (no `updated_at` etc. columns intentionally).
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const allSyncableTables = {
  clients,
  projects,
  tags,
  tasks,
  time_entries,
  entry_tags,
  invoices,
  invoice_lines,
  recurring_invoices,
} as const;
