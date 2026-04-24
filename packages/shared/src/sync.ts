import { z } from 'zod';

/**
 * Sync protocol contracts shared between the desktop app and the API.
 * Versioned so we can evolve without breaking older clients.
 */

export const SYNC_PROTOCOL_VERSION = 1 as const;

export const syncableTableNames = [
  'clients',
  'projects',
  'tags',
  'time_entries',
  'entry_tags',
  'invoices',
  'invoice_lines',
  'recurring_invoices',
] as const;

export type SyncableTableName = (typeof syncableTableNames)[number];

const tableEnum = z.enum(syncableTableNames);

const syncRow = z
  .object({
    updated_at: z.number().int(),
    deleted_at: z.number().int().nullable().optional(),
    device_id: z.string().min(1),
  })
  .passthrough();

export const syncBatch = z.object({
  table: tableEnum,
  rows: z.array(syncRow),
});

export const syncPushRequest = z.object({
  protocol: z.literal(SYNC_PROTOCOL_VERSION),
  device_id: z.string().min(1),
  since: z.number().int().nonnegative(),
  batches: z.array(syncBatch),
});

export const syncPushResponse = z.object({
  server_now: z.number().int(),
  rejected: z
    .array(
      z.object({
        table: tableEnum,
        id: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
});

export const syncPullRequest = z.object({
  protocol: z.literal(SYNC_PROTOCOL_VERSION),
  device_id: z.string().min(1),
  since: z.number().int().nonnegative(),
});

export const syncPullResponse = z.object({
  server_now: z.number().int(),
  batches: z.array(syncBatch),
});

export type SyncRow = z.infer<typeof syncRow>;
export type SyncBatch = z.infer<typeof syncBatch>;
export type SyncPushRequest = z.infer<typeof syncPushRequest>;
export type SyncPushResponse = z.infer<typeof syncPushResponse>;
export type SyncPullRequest = z.infer<typeof syncPullRequest>;
export type SyncPullResponse = z.infer<typeof syncPullResponse>;
