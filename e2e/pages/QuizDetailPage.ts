import { Page, expect } from '@playwright/test';

/**
 * QuizDetailPage — encapsulates interactions on /quiz/[id] and its sub-routes.
 */
export class QuizDetailPage {
  constructor(private readonly page: Page) {}

  async goto(quizId: string) {
    await this.page.goto(`/quiz/${quizId}`);
  }

  // ─── Detail page ─────────────────────────────────────────────────────────

  async expectTitle(titleFragment: string) {
    await expect(
      this.page.getByText(titleFragment, { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  }

  // ─── Enrollment ───────────────────────────────────────────────────────────

  /** Click the "Enroll Now" / "Join Now" button. */
  async enrollInQuiz() {
    await this.page
      .getByRole('button', { name: /enroll now|join now/i })
      .click();
  }

  /** Fill in a text/email/phone/number enrollment form field by label. */
  async fillEnrollmentField(label: string, value: string) {
    // The field sits right after its label text
    const group = this.page
      .locator('div')
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
    await group.locator('input').fill(value);
  }

  /** Select a chip option in a select-type enrollment field. */
  async selectEnrollmentOption(label: string, option: string) {
    const group = this.page
      .locator('div')
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
    await group.getByText(option, { exact: true }).click();
  }

  // ─── Lobby ────────────────────────────────────────────────────────────────

  async expectLobby() {
    await expect(
      this.page.getByText('Starting Soon', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Click "Start Quiz" on the lobby page (only enabled after quiz starts). */
  async startQuiz() {
    await expect(
      this.page.getByRole('button', { name: /start quiz/i }),
    ).toBeEnabled({ timeout: 15_000 });
    await this.page.getByRole('button', { name: /start quiz/i }).click();
  }

  // ─── Question screen ──────────────────────────────────────────────────────

  /**
   * Answer question at position `index` (1-based) with the given `optionLabel`.
   * Clicks "Next Question" or "Finish Quiz" after selecting.
   */
  async answerQuestion(optionLabel: string) {
    // Wait for the question card to appear
    await expect(
      this.page.locator('[class*="question"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Select the answer option
    await this.page.getByText(optionLabel, { exact: true }).click();

    // Advance (next or finish)
    const nextBtn = this.page.getByRole('button', {
      name: /next question|finish quiz/i,
    });
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 });
    await nextBtn.click();
  }

  // ─── Result / score ───────────────────────────────────────────────────────

  /** Wait for and assert the result page is visible. */
  async expectScore() {
    await this.page.waitForURL(/\/result/, { timeout: 15_000 });
    await expect(
      this.page.getByText(/score|correct|accuracy/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  // ─── Winners ─────────────────────────────────────────────────────────────

  async expectWinnersDeclared() {
    await expect(
      this.page.getByText(/winner|leaderboard/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  }
}
