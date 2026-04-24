/**
 * Run with: pnpm --filter @ttf/db migrate:postgres
 * Picks up DATABASE_URL from env.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);
const migrationsFolder = join(__dirname, '../../migrations/postgres');

console.log('Running migrations from', migrationsFolder, '…');
await migrate(db, { migrationsFolder });
console.log('Migrations complete');
await sql.end();
