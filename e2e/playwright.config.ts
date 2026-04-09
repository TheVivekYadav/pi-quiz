import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load e2e environment variables when running locally
dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const APP_URL = process.env.E2E_APP_URL ?? 'http://localhost:4000';

// Only start local servers when the caller has not already brought up the stack
const useExternalStack =
  Boolean(process.env.E2E_API_URL) && Boolean(process.env.E2E_APP_URL);

export default defineConfig({
  testDir: './tests',
  globalSetup: './globalSetup.ts',

  // Each test gets a fresh context by default
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start local dev servers only when not using an externally-managed stack
  webServer: useExternalStack
    ? undefined
    : [
        {
          // NestJS API
          command: 'npm run start:prod',
          cwd: path.resolve(__dirname, '../hmm'),
          url: `${API_URL}/auth/me`,
          reuseExistingServer: true,
          timeout: 60_000,
          env: {
            PORT: '3001',
            NODE_ENV: 'test',
            DATABASE_URL:
              process.env.E2E_DB_URL ??
              'postgresql://pi_quiz:pi_quiz_password@localhost:5433/pi_quiz_e2e',
            DB_POOL_MAX: '10',
            DB_IDLE_TIMEOUT_MS: '10000',
            CORS_ORIGIN: APP_URL,
            MAX_ACTIVE_DEVICES: '10',
          },
        },
        {
          // Expo web app — expects a prior `expo export --platform web` into dist/
          // or falls back to `expo start --web` for interactive dev use.
          command: process.env.E2E_SERVE_CMD ?? 'npx serve dist -l 4000 --no-clipboard',
          cwd: path.resolve(__dirname, '../hmmm'),
          url: APP_URL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
