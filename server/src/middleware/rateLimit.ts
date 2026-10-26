import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { config } from '../config';

function makeLimiter(options: { windowMs: number; limit: number; skipWritesOnly?: boolean }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      if (config.isTest) return true;
      if (options.skipWritesOnly && ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
      return false;
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please wait a few minutes and try again.',
          requestId: res.locals.requestId,
        },
      });
    },
  });
}

export const generalLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 900 });
export const authLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 30 });
export const recoveryLimiter = makeLimiter({ windowMs: 60 * 60 * 1000, limit: 10 });
export const writeLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 180, skipWritesOnly: true });
