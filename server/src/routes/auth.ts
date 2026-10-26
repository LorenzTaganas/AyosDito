import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../../../shared/contracts';
import { config } from '../config';
import { ApiError, asyncHandler, parseBody, unauthorized } from '../lib/http';
import { log } from '../lib/logger';
import { passwordResetEmail, sendMail, verificationEmail } from '../lib/mailer';
import { compareAgainstDummy, hashPassword, verifyPassword } from '../lib/password';
import { deleteOtherSessions, deleteSessionByToken, clearSessionCookie, createSession, setSessionCookie } from '../lib/session';
import { toAuthUser } from '../lib/serialize';
import { futureDate, generateToken, hashToken } from '../lib/tokens';
import { authLimiter, recoveryLimiter, writeLimiter } from '../middleware/rateLimit';
import { requireAuth, sessionUserInclude } from '../middleware/session';
import { prisma } from '../prisma';

export const authRouter = Router();

const GENERIC_RESET_MESSAGE =
  'If an account exists for that email, a password reset link has been generated.';

function exposeDevelopmentUrl(kind: string, url: string): void {
  if (config.isDevelopment) {
    log('info', `Development ${kind} link`, { url });
  }
}

async function issueEmailVerification(userId: string, email: string): Promise<string> {
  const rawToken = generateToken();
  await prisma.$transaction([
    prisma.emailToken.deleteMany({ where: { userId, purpose: 'VERIFY_EMAIL', usedAt: null } }),
    prisma.emailToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        purpose: 'VERIFY_EMAIL',
        expiresAt: futureDate(24 * 60),
      },
    }),
  ]);
  const url = `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  exposeDevelopmentUrl('email verification', url);
  await sendMail({ to: email, ...verificationEmail(url) });
  return url;
}

async function issuePasswordReset(userId: string, email: string): Promise<string> {
  const rawToken = generateToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: futureDate(30),
      },
    }),
  ]);
  const url = `${config.appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  exposeDevelopmentUrl('password reset', url);
  await sendMail({ to: email, ...passwordResetEmail(url) });
  return url;
}

authRouter.get(
  '/csrf',
  asyncHandler(async (_req, res) => {
    res.json({ data: { token: res.locals.csrfToken } });
  }),
);

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);

    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) {
      throw new ApiError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        role: input.role,
        ...(input.role === 'PROVIDER'
          ? { providerProfile: { create: { businessName: input.businessName! } } }
          : { customerProfile: { create: {} } }),
      },
      include: sessionUserInclude,
    });

    const verificationUrl = await issueEmailVerification(user.id, user.email);
    const session = await createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);

    res.status(201).json({
      data: {
        user: toAuthUser(user),
        ...(config.exposeDevLinks ? { devVerificationUrl: verificationUrl } : {}),
      },
    });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: sessionUserInclude,
    });

    if (!user) {
      await compareAgainstDummy(input.password);
      throw unauthorized('Incorrect email or password.');
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw unauthorized('Incorrect email or password.');
    }
    if (user.accountStatus !== 'ACTIVE') {
      throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended. Contact AyosDito support.');
    }

    const session = await createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ data: { user: toAuthUser(user) } });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.ayos_session as string | undefined;
    if (token) await deleteSessionByToken(token);
    clearSessionCookie(res);
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({ data: { user: req.auth ? toAuthUser(req.auth.user) : null } });
  }),
);

authRouter.post(
  '/forgot-password',
  recoveryLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(forgotPasswordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    let devResetUrl: string | undefined;

    if (user && user.accountStatus === 'ACTIVE') {
      devResetUrl = await issuePasswordReset(user.id, user.email);
    }

    res.json({
      data: {
        message: GENERIC_RESET_MESSAGE,
        ...(config.exposeDevLinks && devResetUrl ? { devResetUrl } : {}),
      },
    });
  }),
);

authRouter.post(
  '/reset-password',
  recoveryLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(resetPasswordSchema, req.body);
    const tokenHash = hashToken(input.token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true } } },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired.');
    }

    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new ApiError(400, 'INVALID_RESET_TOKEN', 'This reset link has already been used.');
      }
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: record.userId } });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    clearSessionCookie(res);
    res.json({ data: { message: 'Your password has been updated. You can sign in now.' } });
  }),
);

authRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const input = parseBody(verifyEmailSchema, req.body);
    const tokenHash = hashToken(input.token);
    const record = await prisma.emailToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, emailVerifiedAt: true } } },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'This verification link is invalid or has expired.');
    }

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'This verification link has already been used.');
      }
      if (!record.user.emailVerifiedAt) {
        await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      }
    });

    res.json({ data: { message: 'Your email address is verified.' } });
  }),
);

authRouter.post(
  '/resend-verification',
  requireAuth,
  recoveryLimiter,
  writeLimiter,
  asyncHandler(async (req, res) => {
    if (req.auth!.user.emailVerifiedAt) {
      throw new ApiError(409, 'ALREADY_VERIFIED', 'Your email address is already verified.');
    }
    const url = await issueEmailVerification(req.auth!.user.id, req.auth!.user.email);
    res.json({
      data: {
        message: 'A new verification link has been generated.',
        ...(config.exposeDevLinks ? { devVerificationUrl: url } : {}),
      },
    });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(changePasswordSchema, req.body);
    const userId = req.auth!.user.id;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    const matches = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!matches) {
      throw new ApiError(400, 'INVALID_PASSWORD', 'Your current password is incorrect.');
    }
    const passwordHash = await hashPassword(input.newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await deleteOtherSessions(userId, req.auth!.sessionId);
    res.json({ data: { message: 'Your password has been changed.' } });
  }),
);
