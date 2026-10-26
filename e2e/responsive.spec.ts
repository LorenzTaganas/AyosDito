import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, isMobileProject, signIn } from './helpers';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'the page should not scroll horizontally').toBeLessThanOrEqual(1);
}

test.describe('responsive navigation', () => {
  test('public navigation switches between desktop links and a mobile menu', async ({
    page,
  }, testInfo) => {
    const mobile = isMobileProject(testInfo.project.name);
    await page.goto('/');

    const mainNav = page.getByRole('navigation', { name: 'Main navigation' });
    const menuButton = page.getByRole('button', { name: 'Open menu' });

    if (mobile) {
      await expect(mainNav).toBeHidden();
      await expect(menuButton).toBeVisible();
      await menuButton.click();

      const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
      await expect(mobileNav).toBeVisible();
      await mobileNav.getByRole('link', { name: 'Services' }).click();

      await expect(page).toHaveURL(/\/services$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Repairs and home services, sorted clearly.' }),
      ).toBeVisible();
      await expect(mobileNav).toBeHidden();
    } else {
      await expect(mainNav).toBeVisible();
      await expect(menuButton).toBeHidden();
      await mainNav.getByRole('link', { name: 'Find providers' }).click();

      await expect(page).toHaveURL(/\/providers$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Find local help you can compare.' }),
      ).toBeVisible();
    }

    await expectNoHorizontalOverflow(page);
  });

  test('dashboard navigation uses a sidebar on desktop and a scrollable bar on mobile', async ({
    page,
  }, testInfo) => {
    const mobile = isMobileProject(testInfo.project.name);
    await signIn(page, ACCOUNTS.customer);
    await expect(page).toHaveURL(/\/customer\/dashboard$/);

    const topNav = page.getByRole('navigation', { name: 'Dashboard navigation' });
    const sidebar = page.getByRole('navigation', { name: 'Dashboard sections' });

    if (mobile) {
      await expect(topNav).toBeVisible();
      await expect(sidebar).toBeHidden();
      await topNav.getByRole('link', { name: 'My requests' }).click();
      await expect(page).toHaveURL(/\/customer\/requests$/);
    } else {
      await expect(sidebar).toBeVisible();
      await expect(topNav).toBeHidden();
      await sidebar.getByRole('link', { name: 'Profile & security' }).click();
      await expect(page).toHaveURL(/\/customer\/profile$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Your customer account' }),
      ).toBeVisible();
    }

    await expectNoHorizontalOverflow(page);
  });
});
