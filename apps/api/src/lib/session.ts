import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { nanoid } from 'nanoid';
import type { ApiEnv } from './runtime';

export type RegistrationMode = 'open' | 'first-user' | 'disabled';

export const SESSION_COOKIE = 'tickr_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isSecureRequest(c: Context<ApiEnv>): boolean {
  const proto = c.req.header('x-forwarded-proto');
  if (proto) return proto === 'https';
  return new URL(c.req.url).protocol === 'https:';
}

export function createSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${nanoid()}.${bytesToHex(bytes)}`;
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export function getSessionToken(c: Context<ApiEnv>): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function setSessionTokenCookie(c: Context<ApiEnv>, token: string, expiresAt: number): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: 'Lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearSessionTokenCookie(c: Context<ApiEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}
