import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      APP_BASE_URL: 'http://localhost:5173',
      CORS_ORIGINS: 'http://localhost:5173',
      SESSION_SECRET: 'test-only-session-secret-0123456789abcdef0123456789abcdef',
      BCRYPT_ROUNDS: '4',
      COOKIE_SECURE: 'false',
      UPLOAD_DIR: './uploads-test',
      SEED_DEMO_DATA: 'false',
      SMTP_HOST: '',
    },
  },
});
