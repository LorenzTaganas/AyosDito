import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';
const isDevelopment = !isProduction && !isTest;

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const appBaseUrl = (process.env.APP_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && corsOrigins.includes('*')) {
  throw new Error('CORS_ORIGINS must list explicit origins when credentials are enabled.');
}

const sessionSecret = process.env.SESSION_SECRET ?? '';
if (isProduction && (sessionSecret.length < 32 || sessionSecret.includes('replace'))) {
  throw new Error('SESSION_SECRET must be a long random value in production. See .env.example.');
}
if (!sessionSecret) {
  // Development/test fallback only. Tokens are still random; this secret only
  // keys their hashes. Production startup refuses to continue without a secret.
  console.warn('[config] SESSION_SECRET is not set. Using an insecure development fallback.');
}

const maxUploadMb = parseNumber(process.env.MAX_UPLOAD_MB, 5);

export const config = {
  nodeEnv,
  isProduction,
  isDevelopment,
  isTest,
  port: parseNumber(process.env.PORT, 4000),
  appBaseUrl,
  corsOrigins,
  sessionSecret: sessionSecret || 'dev-only-fallback-secret-do-not-use-in-production',
  sessionTtlMs: parseNumber(process.env.SESSION_TTL_DAYS, 7) * 24 * 60 * 60 * 1000,
  bcryptRounds: parseNumber(process.env.BCRYPT_ROUNDS, isTest ? 4 : 12),
  cookieSecure: process.env.COOKIE_SECURE === 'true' || isProduction,
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
  maxUploadBytes: maxUploadMb * 1024 * 1024,
  exposeDevLinks: !isProduction,
  clientDist: process.env.CLIENT_DIST
    ? path.resolve(process.cwd(), process.env.CLIENT_DIST)
    : path.resolve(process.cwd(), '../client/dist'),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseNumber(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'AyosDito <no-reply@localhost>',
  },
  adminSeed: {
    email: (process.env.ADMIN_EMAIL || 'admin@ayosdito.test').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || 'Admin123!demo',
    name: process.env.ADMIN_NAME || 'AyosDito Admin',
  },
  seedDemoData: process.env.SEED_DEMO_DATA !== 'false',
  demoPassword: process.env.DEMO_PASSWORD || 'Demo1234!',
} as const;

export const SESSION_COOKIE = 'ayos_session';
export const CSRF_COOKIE = 'ayos_csrf';
