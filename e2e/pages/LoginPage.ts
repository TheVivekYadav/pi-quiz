import { Page, expect } from '@playwright/test';

/**
 * LoginPage — encapsulates interactions with the two-step login screen.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  // ─── Step 1: Roll Number ──────────────────────────────────────────────────

  async fillRollNumber(rollNumber: string) {
    await this.page
      .getByPlaceholder(/e\.g\.,?\s*21BCS001/i)
      .fill(rollNumber);
  }

  async clickContinue() {
    await this.page.getByRole('button', { name: /continue/i }).click();
  }

  // ─── Step 2: Profile details ──────────────────────────────────────────────

  async fillProfile(opts: {
    name?: string;
    email?: string;
    branch?: string;
    year?: string;
  }) {
    const { name, email, branch, year } = opts;
    if (name) {
      await this.page.getByPlaceholder(/enter your full name/i).fill(name);
    }
    if (email) {
      await this.page
        .getByPlaceholder(/your\.email@college\.edu/i)
        .fill(email);
    }
    if (branch) {
      await this.page.getByPlaceholder(/e\.g\.,?\s*CSE/i).fill(branch);
    }
    if (year) {
      await this.page.getByPlaceholder(/1 to 6/i).fill(year);
    }
  }

  async submitLogin() {
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  // ─── Combined helpers ─────────────────────────────────────────────────────

  /** Full login flow: step 1 → step 2 → sign in. */
  async login(rollNumber: string, profile: { name?: string } = {}) {
    await this.goto();
    await this.fillRollNumber(rollNumber);
    await this.clickContinue();
    if (profile.name) {
      await this.fillProfile({ name: profile.name });
    }
    await this.submitLogin();
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  /** Verify that the user ended up on the home / tabs screen. */
  async expectLoggedIn() {
    await expect(this.page).toHaveURL(/\/(tabs|$)/, { timeout: 10_000 });
  }

  /** Verify that an alert / error message is visible. */
  async expectError(message: RegExp | string) {
    await expect(
      this.page.getByText(message, { exact: false }),
    ).toBeVisible({ timeout: 5_000 });
  }

  /** Verify the page is still on the login screen (step 1). */
  async expectOnStep1() {
    await expect(
      this.page.getByPlaceholder(/e\.g\.,?\s*21BCS001/i),
    ).toBeVisible();
  }

  /** Verify the page has advanced to step 2 (profile form). */
  async expectOnStep2() {
    await expect(this.page.getByRole('button', { name: /sign in/i })).toBeVisible();
  }
}
