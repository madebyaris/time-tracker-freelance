import { createApiApp } from './app';
import { signAccessToken, verifyAccessToken } from './lib/jwt';
import { createWorkerStore } from './lib/worker-store';
import { parseCorsOrigins, parseRegistrationMode } from './lib/runtime';

type HonoExecutionContext = NonNullable<Parameters<ReturnType<typeof createApiApp>['fetch']>[2]>;

let cachedApp: ReturnType<typeof createApiApp> | null = null;
let cachedBinding: Env['DB'] | null = null;
let cachedSecret: string | null = null;
let cachedOrigin: string | undefined;
let cachedRegistrationMode: string | undefined;

function getWorkerApp(env: Env) {
  if (
    !cachedApp ||
    cachedBinding !== env.DB ||
    cachedSecret !== env.JWT_SECRET ||
    cachedOrigin !== env.CORS_ORIGIN ||
    cachedRegistrationMode !== env.REGISTRATION_MODE
  ) {
    cachedBinding = env.DB;
    cachedSecret = env.JWT_SECRET;
    cachedOrigin = env.CORS_ORIGIN;
    cachedRegistrationMode = env.REGISTRATION_MODE;
    cachedApp = createApiApp({
      runtime: 'cloudflare',
      corsOrigins: parseCorsOrigins(env.CORS_ORIGIN),
      registrationMode: parseRegistrationMode(env.REGISTRATION_MODE, 'first-user'),
      store: createWorkerStore(env.DB),
      signAccessToken: (userId, email) => signAccessToken(env.JWT_SECRET, userId, email),
      verifyAccessToken: (token) => verifyAccessToken(env.JWT_SECRET, token),
    });
  }

  return cachedApp;
}

export default {
  async fetch(request: Request, env: Env, ctx: HonoExecutionContext) {
    const url = new URL(request.url);
    if (
      url.pathname === '/health' ||
      url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/sync/')
    ) {
      return getWorkerApp(env).fetch(request, env, ctx);
    }

    const response = await env.ASSETS.fetch(request);
    const next = new Response(response.body, response);
    next.headers.set('X-Content-Type-Options', 'nosniff');
    next.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next.headers.set('X-Frame-Options', 'DENY');
    next.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:*; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    return next;
  },
};
