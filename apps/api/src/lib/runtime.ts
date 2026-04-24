import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { ApiRuntime } from './store';

export interface ApiVariables {
  runtime: ApiRuntime;
  userId: string;
  email?: string;
}

export type ApiEnv = {
  Variables: ApiVariables;
};

export function getRuntime(c: Context<ApiEnv>): ApiRuntime {
  return c.get('runtime');
}

export function parseCorsOrigins(value?: string): string[] {
  const origins = value
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return origins && origins.length > 0 ? origins : ['*'];
}

export function withRuntime(runtime: ApiRuntime) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    if (runtime.store.ensureReady) {
      await runtime.store.ensureReady();
    }
    c.set('runtime', runtime);
    await next();
  });
}
