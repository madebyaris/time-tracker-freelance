import { and, eq, gt } from 'drizzle-orm';
import { nanoid, syncableTableNames, type SyncableTableName } from '@ttf/shared';
import { schema } from '@ttf/db/postgres';
import { getDb } from './db';
import type { ApiStore, CreateUserInput, UserRecord } from './store';

type Row = Record<string, unknown> & {
  id?: string;
  updated_at: number;
  entry_id?: string;
  tag_id?: string;
};

function shouldSkip(existing: { updated_at: number } | undefined, incoming: Row): boolean {
  if (!existing) return false;
  return incoming.updated_at <= existing.updated_at;
}

export function createNodeStore(): ApiStore {
  return {
    async getUserByEmail(email) {
      const db = getDb();
      const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      return (rows[0] as UserRecord | undefined) ?? null;
    },
    async getUserById(id) {
      const db = getDb();
      const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
      return (rows[0] as UserRecord | undefined) ?? null;
    },
    async createUser(input) {
      const db = getDb();
      const now = Date.now();
      const user: UserRecord = {
        id: nanoid(),
        email: input.email,
        name: input.name,
        password_hash: input.password_hash,
        created_at: now,
        updated_at: now,
      };
      await db.insert(schema.users).values(user);
      return user;
    },
    async upsertSyncRow(table, row, userId) {
      const db = getDb();
      const record = row as Row;

      if (table === 'clients') {
        const id = record.id as string;
        const [existing] = await db.select().from(schema.clients).where(eq(schema.clients.id, id)).limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.clients.$inferInsert;
        if (existing) await db.update(schema.clients).set(value).where(eq(schema.clients.id, id));
        else await db.insert(schema.clients).values(value);
        return;
      }

      if (table === 'projects') {
        const id = record.id as string;
        const [existing] = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, id))
          .limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.projects.$inferInsert;
        if (existing) await db.update(schema.projects).set(value).where(eq(schema.projects.id, id));
        else await db.insert(schema.projects).values(value);
        return;
      }

      if (table === 'tags') {
        const id = record.id as string;
        const [existing] = await db.select().from(schema.tags).where(eq(schema.tags.id, id)).limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.tags.$inferInsert;
        if (existing) await db.update(schema.tags).set(value).where(eq(schema.tags.id, id));
        else await db.insert(schema.tags).values(value);
        return;
      }

      if (table === 'tasks') {
        const id = record.id as string;
        const [existing] = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.id, id))
          .limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.tasks.$inferInsert;
        if (existing) await db.update(schema.tasks).set(value).where(eq(schema.tasks.id, id));
        else await db.insert(schema.tasks).values(value);
        return;
      }

      if (table === 'time_entries') {
        const id = record.id as string;
        const [existing] = await db
          .select()
          .from(schema.time_entries)
          .where(eq(schema.time_entries.id, id))
          .limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.time_entries.$inferInsert;
        if (existing) await db.update(schema.time_entries).set(value).where(eq(schema.time_entries.id, id));
        else await db.insert(schema.time_entries).values(value);
        return;
      }

      if (table === 'entry_tags') {
        const entryId = record.entry_id as string;
        const tagId = record.tag_id as string;
        const [existing] = await db
          .select()
          .from(schema.entry_tags)
          .where(and(eq(schema.entry_tags.entry_id, entryId), eq(schema.entry_tags.tag_id, tagId)))
          .limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.entry_tags.$inferInsert;
        if (existing) {
          await db
            .update(schema.entry_tags)
            .set(value)
            .where(and(eq(schema.entry_tags.entry_id, entryId), eq(schema.entry_tags.tag_id, tagId)));
        } else {
          await db.insert(schema.entry_tags).values(value);
        }
        return;
      }

      if (table === 'invoices') {
        const id = record.id as string;
        const [existing] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.invoices.$inferInsert;
        if (existing) await db.update(schema.invoices).set(value).where(eq(schema.invoices.id, id));
        else await db.insert(schema.invoices).values(value);
        return;
      }

      if (table === 'invoice_lines') {
        const id = record.id as string;
        const [existing] = await db
          .select()
          .from(schema.invoice_lines)
          .where(eq(schema.invoice_lines.id, id))
          .limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.invoice_lines.$inferInsert;
        if (existing) await db.update(schema.invoice_lines).set(value).where(eq(schema.invoice_lines.id, id));
        else await db.insert(schema.invoice_lines).values(value);
        return;
      }

      if (table === 'recurring_invoices') {
        const id = record.id as string;
        const [existing] = await db
          .select()
          .from(schema.recurring_invoices)
          .where(eq(schema.recurring_invoices.id, id))
          .limit(1);
        if (existing && existing.user_id !== userId) return;
        if (shouldSkip(existing, record)) return;
        const value = { ...record, user_id: userId } as typeof schema.recurring_invoices.$inferInsert;
        if (existing) {
          await db.update(schema.recurring_invoices).set(value).where(eq(schema.recurring_invoices.id, id));
        } else {
          await db.insert(schema.recurring_invoices).values(value);
        }
      }
    },
    async listSyncRows(table, userId, since) {
      const db = getDb();

      if (table === 'clients') {
        return (await db
          .select()
          .from(schema.clients)
          .where(and(eq(schema.clients.user_id, userId), gt(schema.clients.updated_at, since)))) as Record<
          string,
          unknown
        >[];
      }

      if (table === 'projects') {
        return (await db
          .select()
          .from(schema.projects)
          .where(and(eq(schema.projects.user_id, userId), gt(schema.projects.updated_at, since)))) as Record<
          string,
          unknown
        >[];
      }

      if (table === 'tags') {
        return (await db
          .select()
          .from(schema.tags)
          .where(and(eq(schema.tags.user_id, userId), gt(schema.tags.updated_at, since)))) as Record<
          string,
          unknown
        >[];
      }

      if (table === 'tasks') {
        return (await db
          .select()
          .from(schema.tasks)
          .where(
            and(eq(schema.tasks.user_id, userId), gt(schema.tasks.updated_at, since)),
          )) as Record<string, unknown>[];
      }

      if (table === 'time_entries') {
        return (await db
          .select()
          .from(schema.time_entries)
          .where(
            and(eq(schema.time_entries.user_id, userId), gt(schema.time_entries.updated_at, since)),
          )) as Record<string, unknown>[];
      }

      if (table === 'entry_tags') {
        return (await db
          .select()
          .from(schema.entry_tags)
          .where(and(eq(schema.entry_tags.user_id, userId), gt(schema.entry_tags.updated_at, since)))) as Record<
          string,
          unknown
        >[];
      }

      if (table === 'invoices') {
        return (await db
          .select()
          .from(schema.invoices)
          .where(and(eq(schema.invoices.user_id, userId), gt(schema.invoices.updated_at, since)))) as Record<
          string,
          unknown
        >[];
      }

      if (table === 'invoice_lines') {
        return (await db
          .select()
          .from(schema.invoice_lines)
          .where(
            and(eq(schema.invoice_lines.user_id, userId), gt(schema.invoice_lines.updated_at, since)),
          )) as Record<string, unknown>[];
      }

      if (table === 'recurring_invoices') {
        return (await db
          .select()
          .from(schema.recurring_invoices)
          .where(
            and(
              eq(schema.recurring_invoices.user_id, userId),
              gt(schema.recurring_invoices.updated_at, since),
            ),
          )) as Record<string, unknown>[];
      }

      const neverTable: never = table;
      throw new Error(`Unsupported sync table: ${String(neverTable)}`);
    },
  };
}

export const nodeSyncTables = syncableTableNames;
