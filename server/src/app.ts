import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { asyncHandler } from './lib/http';
import { log } from './lib/logger';
import { prisma } from './prisma';
import { requestContext } from './middleware/requestContext';
import { attachSession } from './middleware/session';
import { csrfProtection, ensureCsrfCookie } from './middleware/csrf';
import { generalLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundApi } from './middleware/error';
import { authRouter } from './routes/auth';
import { catalogRouter } from './routes/catalog';
import { providersRouter } from './routes/providers';
import { providerMeRouter } from './routes/providerMe';
import { customerRouter } from './routes/customer';
import { favoritesRouter } from './routes/favorites';
import { requestsRouter } from './routes/requests';
import { quotesRouter } from './routes/quotes';
import { reviewReportsRouter, reportsRouter } from './routes/reports';
import { adminRouter } from './routes/admin';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (config.isProduction) app.set('trust proxy', 1);

  app.use(requestContext);
  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '512kb' }));

  app.use('/api', generalLimiter);
  app.use('/api', attachSession, ensureCsrfCookie, csrfProtection);

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        data: {
          status: 'ok',
          uptimeSeconds: Math.round(process.uptime()),
          time: new Date().toISOString(),
        },
      });
    }),
  );

  app.use('/api/auth', authRouter);
  app.use('/api', catalogRouter);
  app.use('/api/providers', providerMeRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/requests', requestsRouter);
  app.use('/api/quotes', quotesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/reviews', reviewReportsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', notFoundApi);

  fs.mkdirSync(config.uploadDir, { recursive: true });
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      index: false,
      dotfiles: 'deny',
      maxAge: '1d',
      setHeaders(res) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
      },
    }),
  );
  app.use('/uploads', (_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'That image does not exist.', requestId: res.locals.requestId },
    });
  });

  const clientIndex = path.join(config.clientDist, 'index.html');
  const hasClientBuild = fs.existsSync(clientIndex);
  if (hasClientBuild) {
    app.use(
      express.static(config.clientDist, {
        index: false,
        maxAge: '1h',
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      res.sendFile(clientIndex);
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text/plain').send('AyosDito API is running. Start the Vite dev server for the web app.');
    });
  }

  app.use(errorHandler);
  return app;
}

export const app = createApp();

if (config.nodeEnv !== 'test' && !config.isTest) {
  log('info', 'Express app created', {
    environment: config.nodeEnv,
    corsOrigins: config.corsOrigins,
    clientBuildFound: fs.existsSync(path.join(config.clientDist, 'index.html')),
  });
}
