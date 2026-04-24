import { Hono } from 'hono';
import { syncPullRequest, syncPushRequest } from '@ttf/shared';
import { requireAuth } from '../lib/bearer';
import { syncableTableNames, SYNC_PROTOCOL_VERSION, type SyncBatch } from '@ttf/shared';
import { getRuntime, type ApiEnv } from '../lib/runtime';

type Row = Record<string, unknown>;

function fixRow(
  table: (typeof syncableTableNames)[number],
  r: Record<string, unknown>,
): Record<string, unknown> {
  const o = { ...r };
  if (table === 'projects' && 'billable' in o) o.billable = Boolean(Number(o.billable));
  if (table === 'time_entries' && 'billable' in o) o.billable = Boolean(Number(o.billable));
  if (table === 'recurring_invoices' && 'enabled' in o) o.enabled = Boolean(Number(o.enabled));
  return o;
}

function mergeUser(r: Row, userId: string, table: (typeof syncableTableNames)[number]) {
  if (table === 'entry_tags') {
    return { ...r, user_id: userId } as Record<string, unknown>;
  }
  return { ...r, user_id: userId } as Record<string, unknown>;
}

export function createSyncRoutes() {
  return new Hono<ApiEnv>()
    .use('*', requireAuth)
    .post('/push', async (c) => {
      const userId = c.get('userId');
      const body = syncPushRequest.safeParse(await c.req.json());
      if (!body.success) return c.json({ error: body.error.flatten() }, 400);
      if (body.data.protocol !== SYNC_PROTOCOL_VERSION) {
        return c.json({ error: 'Unsupported protocol' }, 400);
      }
      const runtime = getRuntime(c);
      const server_now = Date.now();
      const rejected: { table: (typeof syncableTableNames)[number]; id: string; reason: string }[] =
        [];

      for (const batch of body.data.batches) {
        for (const row of batch.rows) {
          const merged = mergeUser(row, userId, batch.table);
          try {
            await runtime.store.upsertSyncRow(batch.table, fixRow(batch.table, merged), userId);
          } catch (e) {
            const id = (row.id as string) ?? `${row.entry_id ?? ''}/${row.tag_id ?? ''}`;
            rejected.push({ table: batch.table, id, reason: (e as Error).message });
          }
        }
      }

      return c.json({ server_now, rejected });
    })
    .get('/pull', async (c) => {
      const userId = c.get('userId');
      const q = c.req.query();
      const since = q.since != null ? Number.parseInt(String(q.since), 10) : 0;
      const p = Number.parseInt(String(q.protocol ?? '1'), 10);
      const parsed = syncPullRequest.safeParse({
        protocol: p,
        device_id: q.device_id ?? 'unknown',
        since: Number.isNaN(since) ? 0 : since,
      });
      if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
      const sinceMs = parsed.data.since;
      const runtime = getRuntime(c);
      const server_now = Date.now();
      const batches: SyncBatch[] = [];

      const t = (table: (typeof syncableTableNames)[number], rows: Record<string, unknown>[]) => {
        if (rows.length) batches.push({ table, rows: rows as never[] });
      };

      for (const table of syncableTableNames) {
        t(table, await runtime.store.listSyncRows(table, userId, sinceMs));
      }

      return c.json({ server_now, batches });
    });
}
