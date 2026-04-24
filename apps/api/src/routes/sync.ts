import { Hono } from 'hono';
import { and, eq, gt } from 'drizzle-orm';
import { syncPullRequest, syncPushRequest } from '@ttf/shared';
import type { AuthVars } from '../lib/bearer';
import { getDb } from '../lib/db';
import { requireAuth } from '../lib/bearer';
import { schema } from '@ttf/db/postgres';
import { syncableTableNames, SYNC_PROTOCOL_VERSION, type SyncBatch } from '@ttf/shared';

type Row = Record<string, unknown> & { id?: string; updated_at: number; entry_id?: string; tag_id?: string };

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

/**
 * LWW client-side won on server: skip if local row in DB is newer.
 */
function shouldSkip(existing: { updated_at: number } | undefined, incoming: Row): boolean {
  if (!existing) return false;
  return (incoming.updated_at as number) <= existing.updated_at;
}

export const syncRoutes = new Hono<{ Variables: AuthVars }>()
  .use('*', requireAuth)
  .post('/push', async (c) => {
    const userId = c.get('userId');
    const body = syncPushRequest.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    if (body.data.protocol !== SYNC_PROTOCOL_VERSION) {
      return c.json({ error: 'Unsupported protocol' }, 400);
    }
    const db = getDb();
    const server_now = Date.now();
    const rejected: { table: (typeof syncableTableNames)[number]; id: string; reason: string }[] = [];

    for (const batch of body.data.batches) {
      for (const row of batch.rows as Row[]) {
        const merged = mergeUser(row, userId, batch.table);
        try {
          await applyUpsert(db, batch.table, fixRow(batch.table, merged), userId);
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
    const db = getDb();
    const server_now = Date.now();
    const batches: SyncBatch[] = [];

    const t = (table: (typeof syncableTableNames)[number], rows: Record<string, unknown>[]) => {
      if (rows.length) batches.push({ table, rows: rows as never[] });
    };

    t(
      'clients',
      await db
        .select()
        .from(schema.clients)
        .where(and(eq(schema.clients.user_id, userId), gt(schema.clients.updated_at, sinceMs))),
    );
    t(
      'projects',
      await db
        .select()
        .from(schema.projects)
        .where(
          and(eq(schema.projects.user_id, userId), gt(schema.projects.updated_at, sinceMs)),
        ),
    );
    t(
      'tags',
      await db
        .select()
        .from(schema.tags)
        .where(
          and(eq(schema.tags.user_id, userId), gt(schema.tags.updated_at, sinceMs)),
        ),
    );
    t(
      'time_entries',
      await db
        .select()
        .from(schema.time_entries)
        .where(
          and(
            eq(schema.time_entries.user_id, userId),
            gt(schema.time_entries.updated_at, sinceMs),
          ),
        ),
    );
    t(
      'entry_tags',
      await db
        .select()
        .from(schema.entry_tags)
        .where(
          and(
            eq(schema.entry_tags.user_id, userId),
            gt(schema.entry_tags.updated_at, sinceMs),
          ),
        ),
    );
    t(
      'invoices',
      await db
        .select()
        .from(schema.invoices)
        .where(
          and(
            eq(schema.invoices.user_id, userId),
            gt(schema.invoices.updated_at, sinceMs),
          ),
        ),
    );
    t(
      'invoice_lines',
      await db
        .select()
        .from(schema.invoice_lines)
        .where(
          and(
            eq(schema.invoice_lines.user_id, userId),
            gt(schema.invoice_lines.updated_at, sinceMs),
          ),
        ),
    );
    t(
      'recurring_invoices',
      await db
        .select()
        .from(schema.recurring_invoices)
        .where(
          and(
            eq(schema.recurring_invoices.user_id, userId),
            gt(schema.recurring_invoices.updated_at, sinceMs),
          ),
        ),
    );

    return c.json({ server_now, batches });
  });

async function applyUpsert(
  db: ReturnType<typeof getDb>,
  table: (typeof syncableTableNames)[number],
  r: Record<string, unknown>,
  userId: string,
): Promise<void> {
  const upd = (r as Row).updated_at;
  if (table === 'clients') {
    const id = r.id as string;
    const [ex] = await db.select().from(schema.clients).where(eq(schema.clients.id, id)).limit(1);
    if (ex && ex.user_id !== userId) return;
    if (shouldSkip(ex, r as Row)) return;
    const row = { ...r, user_id: userId } as typeof schema.clients.$inferInsert;
    if (ex) {
      await db.update(schema.clients).set(row).where(eq(schema.clients.id, id));
    } else {
      await db.insert(schema.clients).values(row);
    }
    return;
  }
  if (table === 'projects') {
    const id = r.id as string;
    const [ex] = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
    if (ex && ex.user_id !== userId) return;
    if (shouldSkip(ex, r as Row)) return;
    const row = { ...r, user_id: userId } as typeof schema.projects.$inferInsert;
    if (ex) await db.update(schema.projects).set(row).where(eq(schema.projects.id, id));
    else await db.insert(schema.projects).values(row);
    return;
  }
  if (table === 'tags') {
    const id = r.id as string;
    const [ex] = await db.select().from(schema.tags).where(eq(schema.tags.id, id)).limit(1);
    if (ex && ex.user_id !== userId) return;
    if (shouldSkip(ex, r as Row)) return;
    const row = { ...r, user_id: userId } as typeof schema.tags.$inferInsert;
    if (ex) await db.update(schema.tags).set(row).where(eq(schema.tags.id, id));
    else await db.insert(schema.tags).values(row);
    return;
  }
  if (table === 'time_entries') {
    const id = r.id as string;
    const [ex] = await db
      .select()
      .from(schema.time_entries)
      .where(eq(schema.time_entries.id, id))
      .limit(1);
    if (ex && ex.user_id !== userId) return;
    if (shouldSkip(ex, r as Row)) return;
    const row = { ...r, user_id: userId } as typeof schema.time_entries.$inferInsert;
    if (ex) await db.update(schema.time_entries).set(row).where(eq(schema.time_entries.id, id));
    else await db.insert(schema.time_entries).values(row);
    return;
  }
  if (table === 'entry_tags') {
    const entry_id = r.entry_id as string;
    const tag_id = r.tag_id as string;
    const [ex] = await db
      .select()
      .from(schema.entry_tags)
      .where(
        and(eq(schema.entry_tags.entry_id, entry_id), eq(schema.entry_tags.tag_id, tag_id)),
      )
      .limit(1);
    if (ex && ex.user_id !== userId) return;
    if (shouldSkip(ex, r as Row)) return;
    const row = { ...r, user_id: userId } as typeof schema.entry_tags.$inferInsert;
    if (ex) {
      await db
        .update(schema.entry_tags)
        .set(row)
        .where(
          and(
            eq(schema.entry_tags.entry_id, entry_id),
            eq(schema.entry_tags.tag_id, tag_id),
          ),
        );
    } else {
      await db.insert(schema.entry_tags).values(row);
    }
    return;
  }
  if (table === 'invoices') {
    const id = r.id as string;
    const [ex] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1);
    if (ex && ex.user_id !== userId) return;
    if (shouldSkip(ex, r as Row)) return;
    const row = { ...r, user_id: userId } as typeof schema.invoices.$inferInsert;
    if (ex) await db.update(schema.invoices).set(row).where(eq(schema.invoices.id, id));
    else await db.insert(schema.invoices).values(row);
    return;
  }
  if (table === 'invoice_lines') {
    const id = r.id as string;
    const [ex] = await db
      .select()
      .from(schema.invoice_lines)
      .where(eq(schema.invoice_lines.id, id))
      .limit(1);
    if (ex && ex.user_id !== userId) return;
    if (shouldSkip(ex, r as Row)) return;
    const row = { ...r, user_id: userId } as typeof schema.invoice_lines.$inferInsert;
    if (ex) await db.update(schema.invoice_lines).set(row).where(eq(schema.invoice_lines.id, id));
    else await db.insert(schema.invoice_lines).values(row);
    return;
  }
  if (table === 'recurring_invoices') {
    const id = r.id as string;
    const [ex] = await db
      .select()
      .from(schema.recurring_invoices)
      .where(eq(schema.recurring_invoices.id, id))
      .limit(1);
    if (ex && ex.user_id !== userId) return;
    if (shouldSkip(ex, r as Row)) return;
    const row = { ...r, user_id: userId } as typeof schema.recurring_invoices.$inferInsert;
    if (ex) {
      await db.update(schema.recurring_invoices).set(row).where(eq(schema.recurring_invoices.id, id));
    } else {
      await db.insert(schema.recurring_invoices).values(row);
    }
  }
}
