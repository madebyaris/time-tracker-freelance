import { serve } from '@hono/node-server';
import app from './app';

const port = Number.parseInt(process.env.PORT ?? '8787', 10);

console.log(`Tickr API listening on http://0.0.0.0:${port}`);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
