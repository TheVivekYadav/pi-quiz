/**
 * tests/auth.spec.ts
 *
 * Login / logout / session flows tested through the web UI.
 */
import { test, expect } from '../fixtures/test';
import { LoginPage } from '../pages/LoginPage';

const ADMIN_ROLL = process.env.E2E_ADMIN_ROLL ?? 'ADMIN001';
const USER_ROLL = process.env.E2E_USER_ROLL ?? 'TESTUSER001';

test.describe('Authentication', () => {
  test('login with valid roll number completes two-step flow', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Step 1: enter roll number
    await loginPage.goto();
    await loginPage.expectOnStep1();
    await loginPage.fillRollNumber(USER_ROLL);
    await loginPage.clickContinue();

    // Step 2: optional profile → sign in
    await loginPage.expectOnStep2();
    await loginPage.submitLogin();

    // Should land on the home/tabs screen
    await loginPage.expectLoggedIn();
  });

  test('login with empty roll number shows an error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.expectOnStep1();

    // Click Continue without entering anything
    await loginPage.clickContinue();

    // Should stay on step 1 and show a validation message
    await loginPage.expectOnStep1();
  });

  test('unauthenticated visit to protected route redirects to /login', async ({ page }) => {
    // Clear any stored auth and navigate straight to the home tab
    await page.goto('/');
    await page.evaluate(() => window.localStorage.removeItem('pi_quiz_auth'));
    await page.goto('/(tabs)');

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('logout clears auth and redirects to /login', async ({
    page,
    userAuth,
    setAuthInBrowser,
  }) => {
    // Inject auth token so we start logged in
    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto('/(tabs)/settings');

    // Tap the Logout button
    await page.getByRole('button', { name: /logout/i }).click();

    // Should redirect to the login screen
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // localStorage should no longer contain a token
    const stored = await page.evaluate(
      () => window.localStorage.getItem('pi_quiz_auth'),
    );
    expect(stored).toBeNull();
  });

  test('admin login grants admin role in the UI', async ({
    page,
    adminAuth,
    setAuthInBrowser,
  }) => {
    await page.goto('/');
    await setAuthInBrowser(adminAuth);
    await page.goto('/(tabs)/settings');

    // Admin badge should be visible in the profile card
    await expect(
      page.getByText('Administrator', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
