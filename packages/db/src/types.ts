/**
 * Domain types shared across SQLite (local), Postgres (self-hosted),
 * and D1 (Cloudflare Workers). These are the canonical shape; per-driver
 * schema files map them to dialect-specific column types.
 */

export type EntrySource = 'manual' | 'timer' | 'pomodoro' | 'calendar';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export type SyncableTable =
  | 'clients'
  | 'projects'
  | 'tags'
  | 'time_entries'
  | 'entry_tags'
  | 'invoices'
  | 'invoice_lines'
  | 'recurring_invoices';

/**
 * Common metadata columns present on every synced table.
 * - `updated_at` drives last-write-wins conflict resolution
 * - `deleted_at` is a tombstone (soft delete) so deletions can sync
 * - `device_id` records origin device for audit/debugging
 */
export interface SyncMeta {
  updated_at: number; // unix epoch ms
  deleted_at: number | null;
  device_id: string;
}
