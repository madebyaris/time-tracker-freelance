import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { ApiRuntime } from './store';
import type { RegistrationMode } from './session';

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
  return origins && origins.length > 0
    ? origins
    : ['http://localhost:1420', 'http://localhost:5173', 'tauri://localhost'];
}

export function parseRegistrationMode(value: string | undefined, fallback: RegistrationMode): RegistrationMode {
  if (value === 'open' || value === 'first-user' || value === 'disabled') {
    return value;
  }
  return fallback;
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
