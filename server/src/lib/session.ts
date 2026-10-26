import type { CookieOptions, Response } from 'express';
import { config, CSRF_COOKIE, SESSION_COOKIE } from '../config';
import { prisma } from '../prisma';
import { generateToken, hashToken } from './tokens';

const baseCookie: CookieOptions = {
  path: '/',
  secure: config.cookieSecure,
  sameSite: 'lax',
};

export function sessionCookieOptions(expiresAt: Date): CookieOptions {
  return { ...baseCookie, httpOnly: true, expires: expiresAt };
}

export function csrfCookieOptions(): CookieOptions {
  return { ...baseCookie, httpOnly: false, maxAge: 7 * 24 * 60 * 60 * 1000 };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs);
  const session = await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  await prisma.session.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  });
  return { token, expiresAt, sessionId: session.id };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { ...baseCookie, httpOnly: true });
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
}

export async function deleteSessionByToken(token: string): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function deleteSessionById(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function deleteOtherSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}
