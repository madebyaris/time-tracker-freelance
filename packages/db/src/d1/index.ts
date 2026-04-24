/**
 * D1 (Cloudflare Workers) shares the SQLite schema; the only difference
 * is the runtime driver (drizzle-orm/d1 vs drizzle-orm/libsql).
 */
export * from '../sqlite';
