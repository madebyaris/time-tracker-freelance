/**
 * Cloudflare Workers entry. Full parity with the Node Hono app requires wiring
 * Drizzle to D1 (`@ttf/db/d1`) and (optionally) R2 for PDFs — same route modules,
 * `DB_DRIVER=d1` at build time. This stub keeps `wrangler deploy` green.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use(
  '*',
  cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'] }),
);
app.get('/health', (c) => c.json({ ok: true, runtime: 'cloudflare', note: 'use Node image for full API' }));
app.all('*', (c) =>
  c.json(
    { error: 'D1 + Hono app not yet deployed from this build — run the Node `tickr` API on your host or add D1 routes here.' },
    501,
  ),
);

export default app;
