import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma';
import {
  TEST_PASSWORD,
  clientFor,
  createClient,
  createUser,
  resetDatabase,
  signIn,
} from './helpers';

const REGISTER_BODY = {
  fullName: 'Nena Bautista',
  email: 'nena@example.test',
  password: TEST_PASSWORD,
  role: 'CUSTOMER',
};

beforeEach(resetDatabase);

describe('registration and CSRF protection', () => {
  it('rejects a state-changing request with no CSRF token', async () => {
    const client = await createClient();
    const response = await client.agent.post('/api/auth/register').send(REGISTER_BODY).expect(403);
    expect(response.body.error.code).toBe('CSRF_FAILED');
  });

  it('rejects an unrecognized Origin even when the CSRF token is valid', async () => {
    const client = await createClient();
    const response = await client
      .post('/api/auth/register', REGISTER_BODY)
      .set('Origin', 'https://attacker.example')
      .expect(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('registers a customer with an HTTP-only session cookie', async () => {
    const client = await createClient();
    const response = await client.post('/api/auth/register', REGISTER_BODY).expect(201);

    expect(response.body.data.user.role).toBe('CUSTOMER');
    expect(response.body.data.user.email).toBe('nena@example.test');
    expect(response.body.data.devVerificationUrl).toContain('/verify-email?token=');
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('ayos_session='));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');

    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body.data.user.email).toBe('nena@example.test');
  });

  it('stores only a hash of the session token', async () => {
    const client = await createClient();
    const response = await client.post('/api/auth/register', REGISTER_BODY).expect(201);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const rawToken = cookies
      .find((cookie) => cookie.startsWith('ayos_session='))!
      .split(';')[0]
      .slice('ayos_session='.length);

    const session = await prisma.session.findFirst();
    expect(session).toBeTruthy();
    expect(session!.tokenHash).not.toBe(rawToken);
    expect(session!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not allow public registration as an administrator', async () => {
    const client = await createClient();
    const response = await client
      .post('/api/auth/register', { ...REGISTER_BODY, role: 'ADMIN' })
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires a business name for provider registration and keeps approval pending', async () => {
    const client = await createClient();
    await client
      .post('/api/auth/register', { ...REGISTER_BODY, role: 'PROVIDER' })
      .expect(422);

    const response = await client
      .post('/api/auth/register', {
        ...REGISTER_BODY,
        email: 'provider@example.test',
        role: 'PROVIDER',
        businessName: 'Bagong Handyman',
      })
      .expect(201);
    expect(response.body.data.user.provider.approvalStatus).toBe('PENDING');
    expect(response.body.data.user.provider.verificationStatus).toBe('UNVERIFIED');
  });

  it('refuses duplicate email addresses', async () => {
    const client = await createClient();
    await client.post('/api/auth/register', REGISTER_BODY).expect(201);
    const duplicate = await client.post('/api/auth/register', REGISTER_BODY).expect(409);
    expect(duplicate.body.error.code).toBe('EMAIL_IN_USE');
  });
});

describe('login, logout, and account status', () => {
  it('rejects wrong passwords and signs a user in with a valid one', async () => {
    await createUser({ email: 'login@example.test', fullName: 'Login User' });
    const client = await createClient();

    const wrong = await client
      .post('/api/auth/login', { email: 'login@example.test', password: 'WrongPassword123' })
      .expect(401);
    expect(wrong.body.error.message).toBe('Incorrect email or password.');

    await signIn(client, 'login@example.test');
    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body.data.user.fullName).toBe('Login User');
  });

  it('does not leak whether an email exists on failed login', async () => {
    const client = await createClient();
    const response = await client
      .post('/api/auth/login', { email: 'nobody@example.test', password: 'WrongPassword123' })
      .expect(401);
    expect(response.body.error.message).toBe('Incorrect email or password.');
  });

  it('prevents customers from entering provider-only endpoints', async () => {
    await createUser({ email: 'customer@example.test' });
    const client = await clientFor('customer@example.test');
    const response = await client.get('/api/providers/me').expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('invalidates the session when an account is suspended', async () => {
    const user = await createUser({ email: 'suspended@example.test' });
    const client = await clientFor('suspended@example.test');

    await prisma.user.update({ where: { id: user.id }, data: { accountStatus: 'SUSPENDED' } });

    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body.data.user).toBeNull();

    const login = await client
      .post('/api/auth/login', { email: 'suspended@example.test', password: TEST_PASSWORD })
      .expect(403);
    expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('deletes the session row on logout', async () => {
    await createUser({ email: 'logout@example.test' });
    const client = await clientFor('logout@example.test');
    expect(await prisma.session.count()).toBe(1);

    await client.post('/api/auth/logout', {}).expect(204);
    expect(await prisma.session.count()).toBe(0);

    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body.data.user).toBeNull();
  });
});

describe('password reset and email verification', () => {
  it('returns a generic response for unknown reset emails', async () => {
    const client = await createClient();
    const response = await client
      .post('/api/auth/forgot-password', { email: 'unknown@example.test' })
      .expect(200);
    expect(response.body.data.message).toContain('If an account exists');
    expect(response.body.data.devResetUrl).toBeUndefined();
  });

  it('resets a password once, revokes sessions, and rejects token reuse', async () => {
    await createUser({ email: 'reset@example.test' });
    const existingSession = await clientFor('reset@example.test');
    const anonymous = await createClient();

    const forgot = await anonymous
      .post('/api/auth/forgot-password', { email: 'reset@example.test' })
      .expect(200);
    const resetUrl = new URL(forgot.body.data.devResetUrl as string);
    const token = resetUrl.searchParams.get('token');
    expect(token).toBeTruthy();

    await anonymous
      .post('/api/auth/reset-password', { token, password: 'BrandNewPass123' })
      .expect(200);

    const afterReset = await existingSession.get('/api/auth/me').expect(200);
    expect(afterReset.body.data.user).toBeNull();

    await anonymous
      .post('/api/auth/login', { email: 'reset@example.test', password: TEST_PASSWORD })
      .expect(401);
    await anonymous
      .post('/api/auth/login', { email: 'reset@example.test', password: 'BrandNewPass123' })
      .expect(200);

    const reuse = await anonymous
      .post('/api/auth/reset-password', { token, password: 'AnotherPass123' })
      .expect(400);
    expect(reuse.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('verifies an email token once and reports the verified state', async () => {
    const client = await createClient();
    const registration = await client.post('/api/auth/register', REGISTER_BODY).expect(201);
    const verificationUrl = new URL(registration.body.data.devVerificationUrl as string);
    const token = verificationUrl.searchParams.get('token');

    await client.post('/api/auth/verify-email', { token }).expect(200);

    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body.data.user.emailVerified).toBe(true);

    const reuse = await client.post('/api/auth/verify-email', { token }).expect(400);
    expect(reuse.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');

    const resend = await client.post('/api/auth/resend-verification', {}).expect(409);
    expect(resend.body.error.code).toBe('ALREADY_VERIFIED');
  });

  it('revokes other sessions after a password change', async () => {
    const user = await createUser({ email: 'change@example.test' });
    const first = await clientFor('change@example.test');
    const second = await clientFor('change@example.test');
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

    await first
      .post('/api/auth/change-password', {
        currentPassword: TEST_PASSWORD,
        newPassword: 'ChangedPassword123',
      })
      .expect(200);

    const firstMe = await first.get('/api/auth/me').expect(200);
    const secondMe = await second.get('/api/auth/me').expect(200);
    expect(firstMe.body.data.user).not.toBeNull();
    expect(secondMe.body.data.user).toBeNull();
  });
});
