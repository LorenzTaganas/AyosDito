import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

test.describe('authentication and route protection', () => {
  test('signed-out visitors are returned to the page they requested after signing in', async ({
    page,
  }) => {
    await page.goto('/customer/requests');

    await expect(page).toHaveURL(/\/login\?next=%2Fcustomer%2Frequests$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await page.locator('#login-email').fill(ACCOUNTS.customer.email);
    await page.locator('#login-password').fill(ACCOUNTS.customer.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page).toHaveURL(/\/customer\/requests$/);
    await expect(page.getByRole('heading', { name: 'My repair requests' })).toBeVisible();
    await expect(page.getByText('Laptop sobrang bagal at nagha-hang')).toBeVisible();
  });

  test('incorrect credentials show a server error and keep the visitor signed out', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill(ACCOUNTS.customer.email);
    await page.locator('#login-password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText('Incorrect email or password.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a customer cannot open the admin console', async ({ page }) => {
    await signIn(page, ACCOUNTS.customer);
    await expect(page).toHaveURL(/\/customer\/dashboard$/);

    await page.goto('/admin/dashboard');

    await expect(
      page.getByRole('heading', { name: 'This area is not available for your role' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Go to my dashboard' }).click();
    await expect(page).toHaveURL(/\/customer\/dashboard$/);
  });

  test('logging out ends the session and protected pages require login again', async ({ page }) => {
    await signIn(page, ACCOUNTS.provider);
    await expect(page).toHaveURL(/\/provider\/dashboard$/);

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/provider/dashboard');
    await expect(page).toHaveURL(/\/login\?next=%2Fprovider%2Fdashboard$/);
  });
});
