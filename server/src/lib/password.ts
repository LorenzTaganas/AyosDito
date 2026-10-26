import bcrypt from 'bcryptjs';
import { config } from '../config';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcryptRounds);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** Keeps failed-login timing closer to successful lookups. */
export async function compareAgainstDummy(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}
