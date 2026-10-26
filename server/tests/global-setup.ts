import { execSync } from 'node:child_process';

export default function globalSetup() {
  // Force-reset only the dedicated test database. The development database
  // (prisma/dev.db) is never touched by the test suite.
  execSync('npx prisma db push --force-reset --skip-generate', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });
}
