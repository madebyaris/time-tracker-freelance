import { createMiddleware } from 'hono/factory';
import { getRuntime, type ApiEnv } from './runtime';
import { clearSessionTokenCookie, getSessionToken, hashSessionToken } from './session';

export const requireAuth = createMiddleware<ApiEnv>(async (c, next) => {
  const h = c.req.header('authorization');
  const runtime = getRuntime(c);

  if (h?.startsWith('Bearer ')) {
    const token = h.slice(7);
    try {
      const p = await runtime.verifyAccessToken(token);
      c.set('userId', p.sub);
      c.set('email', p.email);
      await next();
      return;
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  }

  const sessionToken = getSessionToken(c);
  if (sessionToken) {
    const tokenHash = await hashSessionToken(sessionToken);
    const session = await runtime.store.getSessionByTokenHash(tokenHash);
    if (session && session.expires_at > Date.now()) {
      const user = await runtime.store.getUserById(session.user_id);
      if (user) {
        c.set('userId', user.id);
        c.set('email', user.email);
        await next();
        return;
      }
    }
    await runtime.store.deleteSessionByTokenHash(tokenHash);
    clearSessionTokenCookie(c);
  }

  return c.json({ error: 'Unauthorized' }, 401);
});
