import { createApiApp } from './app';
import { signAccessToken, verifyAccessToken } from './lib/jwt';
import { createWorkerStore, type D1DatabaseLike } from './lib/worker-store';
import { parseCorsOrigins } from './lib/runtime';

type HonoExecutionContext = NonNullable<Parameters<ReturnType<typeof createApiApp>['fetch']>[2]>;

interface WorkerBindings {
  DB: D1DatabaseLike;
  JWT_SECRET: string;
  CORS_ORIGIN?: string;
}

let cachedApp: ReturnType<typeof createApiApp> | null = null;
let cachedBinding: D1DatabaseLike | null = null;
let cachedSecret: string | null = null;
let cachedOrigin: string | undefined;

function getWorkerApp(env: WorkerBindings) {
  if (
    !cachedApp ||
    cachedBinding !== env.DB ||
    cachedSecret !== env.JWT_SECRET ||
    cachedOrigin !== env.CORS_ORIGIN
  ) {
    cachedBinding = env.DB;
    cachedSecret = env.JWT_SECRET;
    cachedOrigin = env.CORS_ORIGIN;
    cachedApp = createApiApp({
      runtime: 'cloudflare',
      corsOrigins: parseCorsOrigins(env.CORS_ORIGIN),
      store: createWorkerStore(env.DB),
      signAccessToken: (userId, email) => signAccessToken(env.JWT_SECRET, userId, email),
      verifyAccessToken: (token) => verifyAccessToken(env.JWT_SECRET, token),
    });
  }

  return cachedApp;
}

export default {
  fetch(request: Request, env: WorkerBindings, ctx: HonoExecutionContext) {
    return getWorkerApp(env).fetch(request, env, ctx);
  },
};
