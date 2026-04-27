import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuthRoutes } from './routes/auth';
import { createSyncRoutes } from './routes/sync';
import { parseCorsOrigins, withRuntime, type ApiEnv } from './lib/runtime';
import type { ApiRuntime } from './lib/store';

export function createApiApp(runtime: ApiRuntime) {
  const app = new Hono<ApiEnv>();
  const corsOrigins = runtime.corsOrigins.length > 0 ? runtime.corsOrigins : parseCorsOrigins();

  app.use('*', withRuntime(runtime));
  app.use('*', async (c, next) => {
    const started = Date.now();
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-Frame-Options', 'DENY');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:*; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    console.log(
      JSON.stringify({
        event: 'request',
        runtime: runtime.runtime,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        status: c.res.status,
        duration_ms: Date.now() - started,
      }),
    );
  });
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return '';
        if (corsOrigins.includes('*')) return origin;
        return corsOrigins.includes(origin) ? origin : '';
      },
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    }),
  );

  app.get('/health', (c) => c.json({ ok: true, service: 'ttf-api', runtime: runtime.runtime }));

  app.route('/auth', createAuthRoutes());
  app.route('/sync', createSyncRoutes());

  return app;
}
