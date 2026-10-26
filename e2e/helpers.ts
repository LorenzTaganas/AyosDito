import { expect, type Page } from '@playwright/test';

export interface DemoAccount {
  email: string;
  password: string;
  fullName: string;
}

export const ACCOUNTS = {
  customer: {
    email: 'customer.maria@ayosdito.test',
    password: 'Demo1234!',
    fullName: 'Maria Santos',
  },
  provider: {
    email: 'provider.laptopcare@ayosdito.test',
    password: 'Demo1234!',
    fullName: 'Jose Ramirez',
  },
  admin: {
    email: 'admin@ayosdito.test',
    password: 'Admin123!demo',
    fullName: 'AyosDito Admin',
  },
} as const satisfies Record<string, DemoAccount>;

export async function signIn(page: Page, account: DemoAccount) {
  await page.goto('/login');
  await page.locator('#login-email').fill(account.email);
  await page.locator('#login-password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

export function isMobileProject(projectName: string) {
  return projectName === 'mobile';
}
