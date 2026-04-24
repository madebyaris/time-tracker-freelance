import { createMiddleware } from 'hono/factory';
import { verifyAccessToken } from './jwt';

export interface AuthVars {
  userId: string;
  email?: string;
}

export const requireAuth = createMiddleware<{ Variables: AuthVars }>(async (c, next) => {
  const h = c.req.header('authorization');
  if (!h?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = h.slice(7);
  try {
    const p = await verifyAccessToken(token);
    c.set('userId', p.sub);
    c.set('email', p.email);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
