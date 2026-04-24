import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { getDb } from '../lib/db';
import { signAccessToken } from '../lib/jwt';
import { schema } from '@ttf/db/postgres';
import { requireAuth, type AuthVars } from '../lib/bearer';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes = new Hono<{ Variables: AuthVars }>()
  .post('/register', async (c) => {
    const body = registerBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const db = getDb();
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, body.data.email))
      .limit(1);
    if (existing.length > 0) return c.json({ error: 'Email already registered' }, 409);
    const id = nanoid();
    const now = Date.now();
    const hash = await bcrypt.hash(body.data.password, 10);
    await db.insert(schema.users).values({
      id,
      email: body.data.email,
      name: body.data.name ?? null,
      password_hash: hash,
      created_at: now,
      updated_at: now,
    });
    const token = await signAccessToken(id, body.data.email);
    return c.json({ token, user: { id, email: body.data.email, name: body.data.name } });
  })
  .post('/login', async (c) => {
    const body = loginBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, body.data.email))
      .limit(1);
    const u = rows[0];
    if (!u?.password_hash) return c.json({ error: 'Invalid credentials' }, 401);
    const ok = await bcrypt.compare(body.data.password, u.password_hash);
    if (!ok) return c.json({ error: 'Invalid credentials' }, 401);
    const token = await signAccessToken(u.id, u.email);
    return c.json({ token, user: { id: u.id, email: u.email, name: u.name } });
  })
  .get('/me', requireAuth, async (c) => {
    const userId = c.get('userId');
    const db = getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const u = rows[0];
    if (!u) return c.json({ error: 'Not found' }, 404);
    return c.json({ id: u.id, email: u.email, name: u.name });
  });
