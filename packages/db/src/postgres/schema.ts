import {
  pgTable,
  text,
  bigint,
  boolean,
  integer,
  primaryKey,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Postgres schema — used by the self-hosted Hono backend.
 * Mirrors the SQLite schema column-for-column; types are widened to
 * proper Postgres types where it helps (booleans, enums, bigint timestamps).
 */

export const entrySourceEnum = pgEnum('entry_source', ['manual', 'timer', 'pomodoro', 'calendar']);
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'paid',
  'overdue',
  'void',
]);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password_hash: text('password_hash'), // null for magic-link only accounts
  created_at: bigint('created_at', { mode: 'number' }).notNull(),
  updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_hash: text('token_hash').notNull().unique(),
    expires_at: bigint('expires_at', { mode: 'number' }).notNull(),
    device_label: text('device_label'),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => ({ userIdx: index('sessions_user_idx').on(t.user_id) }),
);

export const clients = pgTable(
  'clients',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email'),
    currency: text('currency').notNull().default('USD'),
    notes: text('notes'),
    archived_at: bigint('archived_at', { mode: 'number' }),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
    deleted_at: bigint('deleted_at', { mode: 'number' }),
    device_id: text('device_id').notNull(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    updatedIdx: index('clients_updated_idx').on(t.updated_at),
    userIdx: index('clients_user_idx').on(t.user_id),
  }),
);

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id'),
    name: text('name').notNull(),
    color: text('color').notNull().default('#3b82f6'),
    hourly_rate: integer('hourly_rate'),
    currency: text('currency').notNull().default('USD'),
    billable: boolean('billable').notNull().default(true),
    archived_at: bigint('archived_at', { mode: 'number' }),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
    deleted_at: bigint('deleted_at', { mode: 'number' }),
    device_id: text('device_id').notNull(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    clientIdx: index('projects_client_idx').on(t.client_id),
    updatedIdx: index('projects_updated_idx').on(t.updated_at),
    userIdx: index('projects_user_idx').on(t.user_id),
  }),
);

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#64748b'),
  updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
  deleted_at: bigint('deleted_at', { mode: 'number' }),
  device_id: text('device_id').notNull(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const time_entries = pgTable(
  'time_entries',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id'),
    started_at: bigint('started_at', { mode: 'number' }).notNull(),
    ended_at: bigint('ended_at', { mode: 'number' }),
    description: text('description'),
    billable: boolean('billable').notNull().default(true),
    source: entrySourceEnum('source').notNull().default('timer'),
    idle_discarded_seconds: integer('idle_discarded_seconds').notNull().default(0),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
    deleted_at: bigint('deleted_at', { mode: 'number' }),
    device_id: text('device_id').notNull(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    projectIdx: index('time_entries_project_idx').on(t.project_id),
    startedIdx: index('time_entries_started_idx').on(t.started_at),
    updatedUserIdx: index('time_entries_updated_user_idx').on(t.user_id, t.updated_at),
  }),
);

export const entry_tags = pgTable(
  'entry_tags',
  {
    entry_id: text('entry_id').notNull(),
    tag_id: text('tag_id').notNull(),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
    deleted_at: bigint('deleted_at', { mode: 'number' }),
    device_id: text('device_id').notNull(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entry_id, t.tag_id] }),
  }),
);

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    client_id: text('client_id'),
    number: text('number').notNull(),
    issued_at: bigint('issued_at', { mode: 'number' }).notNull(),
    due_at: bigint('due_at', { mode: 'number' }),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    currency: text('currency').notNull().default('USD'),
    subtotal: integer('subtotal').notNull().default(0),
    tax_rate: integer('tax_rate').notNull().default(0),
    total: integer('total').notNull().default(0),
    notes: text('notes'),
    pdf_path: text('pdf_path'),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
    deleted_at: bigint('deleted_at', { mode: 'number' }),
    device_id: text('device_id').notNull(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    clientIdx: index('invoices_client_idx').on(t.client_id),
    issuedIdx: index('invoices_issued_idx').on(t.issued_at),
    userIdx: index('invoices_user_idx').on(t.user_id),
  }),
);

export const invoice_lines = pgTable('invoice_lines', {
  id: text('id').primaryKey(),
  invoice_id: text('invoice_id').notNull(),
  project_id: text('project_id'),
  description: text('description').notNull(),
  hours: integer('hours').notNull(),
  rate: integer('rate').notNull(),
  amount: integer('amount').notNull(),
  position: integer('position').notNull().default(0),
  updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
  deleted_at: bigint('deleted_at', { mode: 'number' }),
  device_id: text('device_id').notNull(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const recurring_invoices = pgTable('recurring_invoices', {
  id: text('id').primaryKey(),
  client_id: text('client_id'),
  schedule_cron: text('schedule_cron').notNull(),
  template_json: text('template_json').notNull(),
  next_run_at: bigint('next_run_at', { mode: 'number' }),
  enabled: boolean('enabled').notNull().default(true),
  updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
  deleted_at: bigint('deleted_at', { mode: 'number' }),
  device_id: text('device_id').notNull(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const allSyncableTables = {
  clients,
  projects,
  tags,
  time_entries,
  entry_tags,
  invoices,
  invoice_lines,
  recurring_invoices,
} as const;
