import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuthRoutes } from './routes/auth';
import { createSyncRoutes } from './routes/sync';
import { parseCorsOrigins, withRuntime, type ApiEnv } from './lib/runtime';
import type { ApiRuntime } from './lib/store';

export function createApiApp(runtime: ApiRuntime) {
  const app = new Hono<ApiEnv>();

  app.use('*', withRuntime(runtime));
  app.use(
    '*',
    cors({
      origin: runtime.corsOrigins.length > 0 ? runtime.corsOrigins : parseCorsOrigins(),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.get('/health', (c) => c.json({ ok: true, service: 'ttf-api', runtime: runtime.runtime }));

  app.route('/auth', createAuthRoutes());
  app.route('/sync', createSyncRoutes());

  return app;
}
