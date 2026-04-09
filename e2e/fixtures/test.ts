/**
 * fixtures/test.ts
 *
 * Extends the base Playwright `test` with project-specific fixtures:
 *   - `adminToken`  — a fresh auth token for the admin user
 *   - `userToken`   — a fresh auth token for the regular test user
 *   - `setAuthInBrowser` — helper to inject a token into the web app's localStorage
 *
 * Usage:
 *   import { test, expect } from '../fixtures/test';
 */
import { test as base, Page } from '@playwright/test';
import { loginAsAdmin, loginAsUser, logoutToken, AuthResult } from './api';

export { expect } from '@playwright/test';

// ─── Types ────────────────────────────────────────────────────────────────────

interface E2EFixtures {
  /** Valid admin auth token (revoked after the test). */
  adminToken: string;
  /** Valid regular-user auth token (revoked after the test). */
  userToken: string;
  /** Full admin auth result (token + user metadata). */
  adminAuth: AuthResult;
  /** Full user auth result (token + user metadata). */
  userAuth: AuthResult;
  /**
   * Injects the given auth result into the web app's localStorage so the app
   * treats the browser as already logged in.
   */
  setAuthInBrowser: (auth: AuthResult) => Promise<void>;
}

// ─── Fixture implementation ───────────────────────────────────────────────────

export const test = base.extend<E2EFixtures>({
  adminAuth: async ({}, use) => {
    const auth = await loginAsAdmin();
    await use(auth);
    await logoutToken(auth.token).catch(() => {});
  },

  userAuth: async ({}, use) => {
    const auth = await loginAsUser();
    await use(auth);
    await logoutToken(auth.token).catch(() => {});
  },

  adminToken: async ({ adminAuth }, use) => {
    await use(adminAuth.token);
  },

  userToken: async ({ userAuth }, use) => {
    await use(userAuth.token);
  },

  setAuthInBrowser: async ({ page }, use) => {
    const helper = async (auth: AuthResult) => {
      await injectAuth(page, auth);
    };
    await use(helper);
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Writes the pi_quiz_auth key into localStorage so the web app picks it up on
 * the next navigation without going through the login screen.
 */
export async function injectAuth(page: Page, auth: AuthResult): Promise<void> {
  const payload = {
    token: auth.token,
    user: {
      userId: auth.userId,
      rollNumber: auth.rollNumber,
      role: auth.role,
      sessionId: auth.sessionId,
    },
  };
  await page.evaluate((p) => {
    window.localStorage.setItem('pi_quiz_auth', JSON.stringify(p));
  }, payload);
}
