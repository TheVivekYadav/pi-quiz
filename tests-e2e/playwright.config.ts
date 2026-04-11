import { defineConfig, devices } from '@playwright/test';

const env = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!env?.CI,
  retries: env?.CI ? 2 : 0,
  workers: env?.CI ? 1 : undefined,
  reporter: [['html'], ['list']],

  use: {
    baseURL: env?.BASE_URL ?? env?.PLAYWRIGHT_BASE_URL ?? 'https://pit.engineer',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    // ── Setup: logs in once and saves storage-state files ──────────────────
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // ── Unauthenticated tests (login page, redirects) ────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*auth\.spec\.ts/,
    },

    // ── Authenticated user tests (quiz browse, accessibility) ────────────
    {
      name: 'chromium-user-auth',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
      testMatch: /.*quiz-browse\.spec\.ts|.*accessibility\.spec\.ts/,
    },

    // ── Admin tests ───────────────────────────────────────────────────────
    {
      name: 'chromium-admin-auth',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' },
      dependencies: ['setup'],
      testMatch: /.*quiz-admin\.spec\.ts/,
    },
  ],
});
