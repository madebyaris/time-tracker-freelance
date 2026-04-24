import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/sqlite/schema.ts',
  out: './migrations/sqlite',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
});
