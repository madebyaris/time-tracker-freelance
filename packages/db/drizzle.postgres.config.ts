import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/postgres/schema.ts',
  out: './migrations/postgres',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/timetracker',
  },
  verbose: true,
  strict: true,
});
