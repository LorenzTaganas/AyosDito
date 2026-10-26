import type { RequestHandler } from 'express';
import { config, CSRF_COOKIE } from '../config';
import { ApiError } from '../lib/http';
import { generateToken, safeEqual } from '../lib/tokens';
import { setCsrfCookie } from '../lib/session';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const ensureCsrfCookie: RequestHandler = (req, res, next) => {
  let token = req.cookies?.[CSRF_COOKIE] as string | undefined;
  if (!token || token.length < 20) {
    token = generateToken();
    setCsrfCookie(res, token);
    req.cookies[CSRF_COOKIE] = token;
  }
  res.locals.csrfToken = token;
  next();
};

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin) {
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (!config.corsOrigins.includes(origin) && origin !== ownOrigin) {
      return next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This request came from an unrecognized origin.'));
    }
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const headerToken = req.get('X-CSRF-Token');
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(
      new ApiError(403, 'CSRF_FAILED', 'Your security token expired. Refresh the page and try again.'),
    );
  }
  next();
};
