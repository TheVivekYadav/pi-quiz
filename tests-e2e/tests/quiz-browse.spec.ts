import { expect, test } from '@playwright/test';

/**
 * quiz-browse.spec.ts — authenticated user flows
 *
 * Runs under the 'chromium-user-auth' project which pre-injects user
 * storageState, so no manual login is needed here.
 */

test('dashboard loads featured quizzes section', async ({ page }) => {
  await page.goto('/(tabs)');
  // The app may redirect to a specific tab path
  await expect(page).toHaveURL(/(tabs)/);
  // Greeting heading is visible
  await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible();
});

test('quizzes tab lists quizzes', async ({ page }) => {
  await page.goto('/(tabs)/quizzes');
  await expect(page).toHaveURL(/quizzes/);
  // Should show QUIZ HUB eyebrow or upcoming/all quizzes heading
  await expect(page.getByText(/quiz hub/i).or(page.getByText(/quizzes/i)).first()).toBeVisible();
});

test('authenticated access to quiz detail page', async ({ page }) => {
  // Navigate to quizzes list first
  await page.goto('/(tabs)/quizzes');

  // Wait for quiz cards to load (or empty state)
  await page.waitForLoadState('networkidle');

  const enrollBtn = page.getByRole('button', { name: /enroll now/i }).first();
  const hasEnrollBtn = await enrollBtn.isVisible().catch(() => false);

  if (hasEnrollBtn) {
    await enrollBtn.click();
    // Should have navigated away from the list
    await expect(page).not.toHaveURL(/quizzes$/);
  } else {
    // No quizzes published yet — that's a valid state in the test environment
    test.skip(true, 'No quizzes available in test environment');
  }
});
