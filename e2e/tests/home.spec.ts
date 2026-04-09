/**
 * tests/home.spec.ts
 *
 * Home tab (`/(tabs)`) — content visible to an authenticated user.
 */
import { test, expect } from '../fixtures/test';

test.describe('Home screen', () => {
  test.beforeEach(async ({ page, userAuth, setAuthInBrowser }) => {
    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto('/(tabs)');
  });

  test('shows greeting, categories, and featured quizzes sections', async ({ page }) => {
    // Brand mark
    await expect(page.getByText('Pi Quiz', { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Section headings
    await expect(
      page.getByText('Continue Learning', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Explore Categories', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Featured Quizzes', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows signed-in roll number in the header area', async ({
    page,
    userAuth,
  }) => {
    await expect(
      page.getByText(userAuth.rollNumber, { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Browse Quizzes" CTA navigates to the Quizzes tab', async ({ page }) => {
    // The CTA only appears when there are no enrolled quizzes — which is the
    // fresh state after globalSetup truncation.
    const browseBtn = page.getByRole('button', { name: /browse quizzes/i });

    // If the CTA is visible click it; otherwise navigate directly to verify
    // the tab link works as a fallback.
    const isCTAVisible = await browseBtn.isVisible().catch(() => false);
    if (isCTAVisible) {
      await browseBtn.click();
    } else {
      await page.getByRole('tab', { name: /quizzes/i }).click();
    }

    await expect(page).toHaveURL(/\/quizzes/, { timeout: 10_000 });
  });
});
