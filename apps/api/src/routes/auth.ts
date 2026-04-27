import { Hono, type Context } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../lib/bearer';
import { getRuntime, type ApiEnv } from '../lib/runtime';
import {
  clearSessionTokenCookie,
  createSessionToken,
  getSessionToken,
  hashSessionToken,
  SESSION_TTL_MS,
  setSessionTokenCookie,
} from '../lib/session';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

function publicUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

async function createWebSession(c: Context<ApiEnv>, userId: string) {
  const runtime = getRuntime(c);
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await runtime.store.createSession({
    userId,
    tokenHash,
    expiresAt,
    deviceLabel: c.req.header('user-agent')?.slice(0, 160) ?? 'web',
  });
  setSessionTokenCookie(c, token, expiresAt);
}

export function createAuthRoutes() {
  return new Hono<ApiEnv>()
    .post('/register', async (c) => {
      const body = registerBody.safeParse(await c.req.json());
      if (!body.success) return c.json({ error: body.error.flatten() }, 400);
      const runtime = getRuntime(c);
      if (runtime.registrationMode === 'disabled') {
        return c.json({ error: 'Registration is disabled' }, 403);
      }
      if (runtime.registrationMode === 'first-user' && (await runtime.store.countUsers()) > 0) {
        return c.json({ error: 'Registration is closed after the first user' }, 403);
      }
      const existing = await runtime.store.getUserByEmail(body.data.email);
      if (existing) return c.json({ error: 'Email already registered' }, 409);
      const hash = await bcrypt.hash(body.data.password, 10);
      const user = await runtime.store.createUser({
        email: body.data.email,
        name: body.data.name ?? null,
        password_hash: hash,
      });
      const token = await runtime.signAccessToken(user.id, user.email);
      await createWebSession(c, user.id);
      return c.json({ token, user: publicUser(user) });
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
      await createWebSession(c, u.id);
      return c.json({ token, user: publicUser(u) });
    })
    .post('/logout', async (c) => {
      const sessionToken = getSessionToken(c);
      if (sessionToken) {
        await getRuntime(c).store.deleteSessionByTokenHash(await hashSessionToken(sessionToken));
      }
      clearSessionTokenCookie(c);
      return c.json({ ok: true });
    })
    .get('/me', requireAuth, async (c) => {
      const userId = c.get('userId');
      const u = await getRuntime(c).store.getUserById(userId);
      if (!u) return c.json({ error: 'Not found' }, 404);
      return c.json(publicUser(u));
    });
}
