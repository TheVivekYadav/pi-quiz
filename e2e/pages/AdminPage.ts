import { Page, expect } from '@playwright/test';

/**
 * AdminPage — encapsulates the Admin tab (`/(tabs)/admin`) and related flows.
 */
export class AdminPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/(tabs)/admin');
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async expectAdminConsole() {
    await expect(
      this.page.getByText('Admin Console', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  }

  async expectAccessDenied() {
    await expect(
      this.page.getByText('Access denied', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Expect a quiz card with the given title to be listed. */
  async expectQuizInList(titleFragment: string) {
    await expect(
      this.page.getByText(titleFragment, { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Expect the quiz to have been removed from the list. */
  async expectQuizAbsent(titleFragment: string) {
    await expect(
      this.page.getByText(titleFragment, { exact: false }),
    ).toHaveCount(0, { timeout: 10_000 });
  }

  // ─── Quiz creation ────────────────────────────────────────────────────────

  /**
   * Navigate to the quiz creator and fill out the form.
   * This drives the `/create-quiz` screen.
   */
  async createQuiz(data: {
    title: string;
    topic: string;
    category: string;
    level: string;
    durationMinutes: string;
    startsAt: string;
    description?: string;
  }) {
    // Open creator from the admin tab
    await this.page.getByRole('button', { name: /open creator/i }).click();
    await this.page.waitForURL(/\/create-quiz/, { timeout: 10_000 });

    await this.page.getByPlaceholder(/title/i).fill(data.title);
    await this.page.getByPlaceholder(/topic/i).fill(data.topic);
    await this.page.getByPlaceholder(/category/i).fill(data.category);
    await this.page.getByPlaceholder(/level/i).fill(data.level);
    await this.page
      .getByPlaceholder(/duration/i)
      .fill(data.durationMinutes);
    await this.page.getByPlaceholder(/starts at/i).fill(data.startsAt);
    if (data.description) {
      await this.page.getByPlaceholder(/description/i).fill(data.description);
    }

    await this.page.getByRole('button', { name: /create|save/i }).click();
    await this.page.waitForURL(/\/quiz\//, { timeout: 10_000 });
  }

  // ─── Quiz list actions ────────────────────────────────────────────────────

  /** Click the delete icon for a quiz in the admin list. */
  async deleteQuiz(titleFragment: string) {
    const row = this.page
      .locator('[class*="quizRow"], div')
      .filter({ hasText: titleFragment })
      .first();
    await row.getByRole('button', { name: /delete quiz/i }).click();
    // Confirm the alert dialog
    this.page.once('dialog', (dialog) => dialog.accept());
  }

  /** Click the start icon for a quiz. */
  async startQuiz(titleFragment: string) {
    const row = this.page
      .locator('[class*="quizRow"], div')
      .filter({ hasText: titleFragment })
      .first();
    await row.getByRole('button', { name: /start quiz/i }).click();
    this.page.once('dialog', (dialog) => dialog.accept());
  }

  /** Click the declare-winners icon for a (past) quiz. */
  async declareWinners(titleFragment: string) {
    const row = this.page
      .locator('[class*="quizRow"], div')
      .filter({ hasText: titleFragment })
      .first();
    await row.getByRole('button', { name: /declare winners/i }).click();
    this.page.once('dialog', (dialog) => dialog.accept());
  }

  // ─── User sessions section ────────────────────────────────────────────────

  /** Search for a user in the sessions section. */
  async searchUser(query: string) {
    await this.page
      .getByPlaceholder(/search by roll number or name/i)
      .fill(query);
  }

  /** Navigate to the sessions page for a specific user. */
  async openUserSessions(nameOrRoll: string) {
    await this.page
      .locator('div, [role="button"]')
      .filter({ hasText: nameOrRoll })
      .first()
      .click();
    await this.page.waitForURL(/\/admin\/user-sessions/, { timeout: 10_000 });
  }
}
