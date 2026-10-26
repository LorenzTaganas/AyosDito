import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../config';
import { log } from '../lib/logger';

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  if (config.isTest) return next();

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    if (!req.path.startsWith('/api/')) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    log(res.statusCode >= 500 ? 'error' : 'info', 'request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip,
    });
  });
  next();
};
