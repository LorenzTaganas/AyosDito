import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

test.describe('admin console', () => {
  test('every moderation area loads and catalog actions require an explicit dialog step', async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Platform overview' })).toBeVisible();
    await expect(page.getByText('Wired WiFi Tech')).toBeVisible();
    await expect(page.getByText(/No open reports/)).toBeVisible();

    const sections = [
      {
        path: '/admin/providers',
        heading: 'Applications and approvals',
        text: 'Wired WiFi Tech',
      },
      {
        path: '/admin/verifications',
        heading: 'Verification requests',
        text: /A badge is granted only after an administrator completes the check/,
      },
      {
        path: '/admin/users',
        heading: 'People and roles',
        text: 'Ana Dela Cruz',
      },
      {
        path: '/admin/reports',
        heading: 'Reports queue',
        text: /A report does not remove content automatically/,
      },
      {
        path: '/admin/reviews',
        heading: 'Review moderation',
        text: /Malinaw magpaliwanag/,
      },
      {
        path: '/admin/categories',
        heading: 'Service categories',
        text: 'Laptop & Computer Repair',
      },
      {
        path: '/admin/locations',
        heading: 'Locations and service areas',
        text: 'City of Malolos',
      },
      {
        path: '/admin/audit',
        heading: 'Audit log',
        text: /Read-only history of administrative decisions/,
      },
    ];

    for (const section of sections) {
      await page.goto(section.path);
      await expect(
        page.getByRole('heading', { level: 1, name: section.heading }),
      ).toBeVisible();
      await expect(page.getByText(section.text).first()).toBeVisible();
    }

    await page.goto('/admin/categories');
    await page.getByRole('button', { name: 'Add category' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Add a service category')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });
});
