import type { Prisma } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import { SESSION_COOKIE } from '../config';
import { asyncHandler, forbidden, unauthorized } from '../lib/http';
import { clearSessionCookie } from '../lib/session';
import { hashToken } from '../lib/tokens';
import { prisma } from '../prisma';

export const sessionUserInclude = {
  providerProfile: true,
  customerProfile: true,
} satisfies Prisma.UserInclude;

export type SessionUser = Prisma.UserGetPayload<{ include: typeof sessionUserInclude }>;

export const attachSession: RequestHandler = asyncHandler(async (req, res, next) => {
  req.auth = null;
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return next();

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: sessionUserInclude } },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    clearSessionCookie(res);
    return next();
  }

  if (session.user.accountStatus !== 'ACTIVE') {
    await prisma.session.deleteMany({ where: { id: session.id } });
    clearSessionCookie(res);
    return next();
  }

  req.auth = { user: session.user, sessionId: session.id };
  next();
});

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  if (req.auth.user.accountStatus !== 'ACTIVE') {
    return next(forbidden('This account is not active. Contact AyosDito support.'));
  }
  next();
};

export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.user.role)) {
      return next(forbidden('This area is not available for your account type.'));
    }
    next();
  };
}

export function currentUser(req: Request): SessionUser {
  if (!req.auth) throw unauthorized();
  return req.auth.user;
}

export function currentProvider(req: Request) {
  const user = currentUser(req);
  if (user.role !== 'PROVIDER' || !user.providerProfile) {
    throw forbidden('Complete a provider account to use this feature.');
  }
  return user.providerProfile;
}
