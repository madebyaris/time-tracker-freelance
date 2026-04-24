import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../lib/bearer';
import { getRuntime, type ApiEnv } from '../lib/runtime';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

export function createAuthRoutes() {
  return new Hono<ApiEnv>()
    .post('/register', async (c) => {
      const body = registerBody.safeParse(await c.req.json());
      if (!body.success) return c.json({ error: body.error.flatten() }, 400);
      const runtime = getRuntime(c);
      const existing = await runtime.store.getUserByEmail(body.data.email);
      if (existing) return c.json({ error: 'Email already registered' }, 409);
      const hash = await bcrypt.hash(body.data.password, 10);
      const user = await runtime.store.createUser({
        email: body.data.email,
        name: body.data.name ?? null,
        password_hash: hash,
      });
      const token = await runtime.signAccessToken(user.id, user.email);
      return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    })
    .post('/login', async (c) => {
      const body = loginBody.safeParse(await c.req.json());
      if (!body.success) return c.json({ error: body.error.flatten() }, 400);
      const runtime = getRuntime(c);
      const u = await runtime.store.getUserByEmail(body.data.email);
      if (!u?.password_hash) return c.json({ error: 'Invalid credentials' }, 401);
      const ok = await bcrypt.compare(body.data.password, u.password_hash);
      if (!ok) return c.json({ error: 'Invalid credentials' }, 401);
      const token = await runtime.signAccessToken(u.id, u.email);
      return c.json({ token, user: { id: u.id, email: u.email, name: u.name } });
    })
    .get('/me', requireAuth, async (c) => {
      const userId = c.get('userId');
      const u = await getRuntime(c).store.getUserById(userId);
      if (!u) return c.json({ error: 'Not found' }, 404);
      return c.json({ id: u.id, email: u.email, name: u.name });
    });
}
