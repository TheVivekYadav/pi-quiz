import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * accessibility.spec.ts — WCAG 2.1 AA accessibility checks
 *
 * Uses @axe-core/playwright to scan critical pages for accessibility
 * violations (missing labels, low contrast, ARIA issues, etc.).
 *
 * Runs under the 'chromium-user-auth' project so authenticated pages are
 * also covered without repeating a login interaction.
 */

test('login page has no critical accessibility violations', async ({ page }) => {
  // Run as unauthenticated by clearing storage before navigating
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('dashboard has no critical accessibility violations', async ({ page }) => {
  await page.goto('/(tabs)');
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('quizzes tab has no critical accessibility violations', async ({ page }) => {
  await page.goto('/(tabs)/quizzes');
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
