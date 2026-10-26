import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

test.describe('provider workspace', () => {
  test('approval, listings, reviews, and verification boundaries are visible', async ({ page }) => {
    await signIn(page, ACCOUNTS.provider);
    await expect(page).toHaveURL(/\/provider\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1, name: /Kumusta, Jose\?/ })).toBeVisible();
    await expect(page.getByText('Demo provider', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(/This business, its services, and its reviews are sample records/),
    ).toBeVisible();

    await page.goto('/provider/services');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'What you offer and how much it starts at',
      }),
    ).toBeVisible();
    await expect(page.getByText('Laptop diagnostics and repair', { exact: true })).toBeVisible();

    await page.goto('/provider/reviews');
    await expect(
      page.getByRole('heading', { level: 1, name: 'What customers say after the work' }),
    ).toBeVisible();
    await expect(page.getByText('Demo reviews', { exact: true })).toBeVisible();
    await expect(page.getByText(/Malinaw magpaliwanag/)).toBeVisible();

    await page.goto('/provider/verification');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Verification requests' }),
    ).toBeVisible();
    await expect(
      page.getByText(/Being an approved provider does not automatically verify your identity/),
    ).toBeVisible();
    await expect(page.getByText('Not yet verified', { exact: true }).first()).toBeVisible();
  });
});
