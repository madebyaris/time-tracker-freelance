import { createMiddleware } from 'hono/factory';
import { getRuntime, type ApiEnv } from './runtime';

export const requireAuth = createMiddleware<ApiEnv>(async (c, next) => {
  const h = c.req.header('authorization');
  if (!h?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = h.slice(7);
  try {
    const p = await getRuntime(c).verifyAccessToken(token);
    c.set('userId', p.sub);
    c.set('email', p.email);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
