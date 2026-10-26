import fs from 'node:fs';
import http from 'node:http';
import { app } from './app';
import { config } from './config';
import { log } from './lib/logger';
import { prisma } from './prisma';

fs.mkdirSync(config.uploadDir, { recursive: true });

const server = http.createServer(app);

server.listen(config.port, () => {
  log('info', `AyosDito API listening on http://localhost:${config.port}`, {
    environment: config.nodeEnv,
  });
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', `Received ${signal}. Shutting down.`);

  const timeout = setTimeout(() => {
    log('error', 'Forced exit after shutdown timeout');
    process.exit(1);
  }, 10_000);
  timeout.unref();

  server.close(async (error) => {
    if (error) {
      log('error', 'HTTP server close failed', { error: error.message });
    }
    await prisma.$disconnect().catch(() => undefined);
    clearTimeout(timeout);
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
  void shutdown('uncaughtException');
});
