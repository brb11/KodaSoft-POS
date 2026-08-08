import { Request, Response } from 'express';
import { env } from '../../config/env';

export const REFRESH_COOKIE_NAME = 'refresh_token';
// Scoped to auth endpoints so the browser only ever sends the refresh token
// where it is needed, never to other API routes.
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function parseDuration(value: string, fallbackDays: number): number {
  const m = /^(\d+)\s*([smhdw])?$/.exec(value.trim());
  if (!m) return fallbackDays * 86400;
  const n = Number(m[1]);
  const factor: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  return n * (factor[m[2] ?? 'd'] ?? 86400);
}

export function refreshTokenTtlSeconds(): number {
  return parseDuration(env.JWT_REFRESH_EXPIRES_IN, 7);
}

function cookieBaseOptions() {
  return {
    httpOnly: true, // keep the token out of JavaScript (XSS-safe)
    secure: env.NODE_ENV === 'production', // HTTPS-only in production
    sameSite: 'lax' as const, // CSRF-safe while still working through the dev proxy
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieBaseOptions(),
    maxAge: refreshTokenTtlSeconds() * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieBaseOptions());
}

export function getRefreshToken(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
