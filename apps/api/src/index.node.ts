import { serve } from '@hono/node-server';
import { createApiApp } from './app';
import { signAccessToken, verifyAccessToken } from './lib/jwt';
import { createNodeStore } from './lib/node-store';
import { parseCorsOrigins } from './lib/runtime';

const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET is not set');
}

const app = createApiApp({
  runtime: 'node',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  store: createNodeStore(),
  signAccessToken: (userId, email) => signAccessToken(jwtSecret, userId, email),
  verifyAccessToken: (token) => verifyAccessToken(jwtSecret, token),
});

console.log(`Tickr API listening on http://0.0.0.0:${port}`);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
