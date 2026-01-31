import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login button on home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('displays CloudPilot heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /cloudpilot/i })).toBeVisible();
  });

  test('shows loading state initially', async ({ page }) => {
    // Intercept the session request to delay it
    await page.route('/api/auth/session', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/');

    // Should show login button after session check fails
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
