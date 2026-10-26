import { expect, test } from '@playwright/test';

test.describe('public marketplace', () => {
  test('home page states the product purpose and demo status honestly', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/AyosDito/);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText('May sira?');
    await expect(heading).toContainText('May maaasahang aayos!');

    await expect(page.getByText(/MVP demo environment/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'What this means' })).toBeVisible();
    await expect(
      page.getByText(/Built for laptops, phones, appliances, electrical work, plumbing, aircon/),
    ).toBeVisible();
  });

  test('provider directory returns database records and filters by keyword', async ({ page }) => {
    await page.goto('/providers');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Find local help you can compare.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Malolos Laptop Care profile' })).toBeVisible();
    await expect(page.getByText(/Some results are labeled/)).toBeVisible();

    await page.getByLabel('Search providers by keyword').fill('laptop');
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    await expect(page).toHaveURL(/\/providers\?q=laptop$/);
    await expect(page.getByRole('link', { name: 'View Malolos Laptop Care profile' })).toBeVisible();
  });

  test('provider profile shows seeded reviews and honest verification status', async ({ page }) => {
    await page.goto('/providers');
    await page.getByRole('link', { name: 'View Malolos Laptop Care profile' }).click();

    await expect(page).toHaveURL(/\/providers\/[^/]+$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Malolos Laptop Care' }),
    ).toBeVisible();
    await expect(page.getByText('Demo provider', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Rated 4.7 out of 5 from 3 reviews' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reviews', exact: true })).toBeVisible();
    await expect(page.getByText(/Malinaw magpaliwanag/)).toBeVisible();
    await expect(
      page.getByText(/No identity or business verification has been approved yet/),
    ).toBeVisible();
  });
});
