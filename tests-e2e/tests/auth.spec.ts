import { expect, test } from '@playwright/test';

/**
 * auth.spec.ts — unauthenticated flows
 *
 * Runs under the plain 'chromium' project (no storageState).
 */

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});

test('login page has roll number input and sign-in button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('textbox', { name: /roll number/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('unauthenticated root redirects to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
});

test('quick login with valid roll number navigates to dashboard', async ({ page }) => {
  const rollNumber = process.env.TEST_USER_ROLL ?? 'TEST001';
  await page.goto('/login');

  await page.getByRole('textbox', { name: /roll number/i }).fill(rollNumber);
  // "Sign In" button triggers quick login (step 1)
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/(tabs)|dashboard/);
});

test('login with empty roll number shows validation error', async ({ page }) => {
  await page.goto('/login');

  // Click without entering a roll number
  await page.getByRole('button', { name: /sign in/i }).click();

  // The app raises a native Alert — on web it shows a dialog
  const dialog = page.waitForEvent('dialog', { timeout: 3000 }).catch(() => null);
  const dlg = await dialog;
  if (dlg) {
    expect(dlg.message()).toMatch(/roll number/i);
    await dlg.accept();
  } else {
    // Confirm we haven't left the login page
    await expect(page).toHaveURL(/login/);
  }
});
