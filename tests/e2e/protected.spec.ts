import { expect, test } from '@playwright/test';

test.describe('Protected Routes', () => {
  test('redirects to home when accessing dashboard unauthenticated', async ({ page }) => {
    // Mock unauthenticated session
    await page.route('/api/auth/session', async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/dashboard');

    // Should redirect to home
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows dashboard when authenticated', async ({ page }) => {
    // Mock authenticated session
    await page.route('/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            emailVerified: true,
            image: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          session: {
            id: 'test-session-id',
            userId: 'test-user-id',
            token: 'test-token',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            ipAddress: null,
            userAgent: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/dashboard');

    // Should show dashboard
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText('Test User')).toBeVisible();
  });
});
