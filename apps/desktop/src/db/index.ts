import Database from '@tauri-apps/plugin-sql';
import { migrations } from './migrations';

let _db: Database | null = null;

/**
 * Singleton SQLite handle. The plugin stores the file under the app's
 * `appDataDir` (~/Library/Application Support/<bundle-id>/tickr.db on macOS).
 */
export async function getDb(): Promise<Database> {
  if (_db) return _db;
  const db = await Database.load('sqlite:tickr.db');
  await runMigrations(db);
  _db = db;
  return db;
}

async function runMigrations(db: Database): Promise<void> {
  // Each statement in a migration is split & executed; tauri-plugin-sql
  // doesn't allow multi-statement SQL through `execute`.
  const result = (await db.select<Array<{ user_version: number }>>('PRAGMA user_version')) ?? [];
  const current = result[0]?.user_version ?? 0;

  for (const m of migrations) {
    if (m.version <= current) continue;
    const stmts = m.sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of stmts) {
      await db.execute(stmt);
    }
    await db.execute(`PRAGMA user_version = ${m.version}`);
    console.info(`[db] applied migration ${m.version}: ${m.name}`);
  }
}

/** Convenience helpers — keep call sites concise. */
export async function exec(sql: string, bind: unknown[] = []) {
  const db = await getDb();
  return db.execute(sql, bind);
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  bind: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, bind);
}
