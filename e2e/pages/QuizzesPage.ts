import { Page, expect } from '@playwright/test';

/**
 * QuizzesPage — encapsulates the Quizzes tab (`/(tabs)/quizzes`).
 */
export class QuizzesPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/(tabs)/quizzes');
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  /** Expect the page to display a non-empty list of quiz cards. */
  async expectQuizList() {
    // Each quiz card has the quiz title in a pressable element
    await expect(
      this.page.locator('[aria-label="Open"], text=/Beginner|Intermediate|Expert/i').first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Expect the heading for the regular-user view. */
  async expectUpcomingHeading() {
    await expect(
      this.page.getByText('Upcoming Quizzes', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Expect the heading for the admin view. */
  async expectAllQuizzesHeading() {
    await expect(
      this.page.getByText('All Quizzes', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Expect at least one card to show the "Past" badge. */
  async expectPastBadgeVisible() {
    await expect(
      this.page.getByText('Past', { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  /**
   * Find a quiz card whose title contains `titleFragment` and click the
   * "Open" button on it to navigate to its detail page.
   */
  async openQuiz(titleFragment: string) {
    const card = this.page
      .locator('div, [role="button"]')
      .filter({ hasText: titleFragment })
      .first();
    await card.getByText('Open').click();
    await this.page.waitForURL(/\/quiz\//, { timeout: 10_000 });
  }
}
