import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { syncRoutes } from './routes/sync';

const app = new Hono();

const origin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? ['*'];

app.use(
  '*',
  cors({
    origin,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/health', (c) => c.json({ ok: true, service: 'ttf-api' }));

app.route('/auth', authRoutes);
app.route('/sync', syncRoutes);

export default app;
