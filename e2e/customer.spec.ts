import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

test.describe('customer workspace', () => {
  test('seeded dashboard, request filters, and request validation work together', async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.customer);
    await expect(page).toHaveURL(/\/customer\/dashboard$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /Kumusta, Maria\?/ }),
    ).toBeVisible();
    await expect(page.getByText('Demo customer', { exact: true })).toBeVisible();

    for (const label of ['Open requests', 'Quotes to review', 'Active jobs', 'Completed']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('Laptop sobrang bagal at nagha-hang')).toBeVisible();
    await expect(page.getByText('Aircon cleaning bago magtag-init')).toBeVisible();

    await page.goto('/customer/requests');
    await expect(page.getByRole('heading', { name: 'My repair requests' })).toBeVisible();
    await page.getByRole('tab', { name: 'Completed', exact: true }).click();

    await expect(page).toHaveURL(/status=COMPLETED/);
    await expect(
      page.getByText('Laptop hindi na mag-on pagkatapos mabagsakan'),
    ).toBeVisible();
    await expect(page.getByText('Laptop sobrang bagal at nagha-hang')).toHaveCount(0);

    await page.goto('/customer/requests/new');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Describe what needs fixing' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Post request' }).click();

    await expect(page.getByText('Choose a service category.', { exact: true })).toBeVisible();
    await expect(page.getByText('Describe the problem briefly.', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Describe the problem in at least 20 characters.', { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/customer\/requests\/new$/);
  });
});
