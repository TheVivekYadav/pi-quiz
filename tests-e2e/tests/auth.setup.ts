/**
 * auth.setup.ts
 *
 * Runs once before all authenticated test projects.
 * Calls the real API to obtain tokens, injects them into the browser's
 * localStorage (matching what the app's auth-session module reads), then
 * saves the browser storage state to .auth/user.json and .auth/admin.json
 * so every subsequent test skips the login UI entirely.
 */

import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const USER_FILE = path.join(__dirname, '../.auth/user.json');
const ADMIN_FILE = path.join(__dirname, '../.auth/admin.json');
const STORAGE_KEY = 'pi_quiz_auth';

/** Call POST /api/auth/login and return the token payload. */
async function apiLogin(
  request: import('@playwright/test').APIRequestContext,
  rollNumber: string,
) {
  const response = await request.post('/api/auth/login', {
    data: { rollNumber },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok()) {
    throw new Error(
      `Login failed for ${rollNumber}: ${response.status()} ${await response.text()}`,
    );
  }
  return response.json() as Promise<{
    token: string;
    userId: number;
    rollNumber: string;
    role: 'admin' | 'user';
    sessionId?: string;
  }>;
}

setup('create user auth state', async ({ page, request }) => {
  fs.mkdirSync(path.dirname(USER_FILE), { recursive: true });

  const rollNumber = process.env.TEST_USER_ROLL ?? 'TEST001';
  const data = await apiLogin(request, rollNumber);

  // Navigate to root so localStorage is scoped to the correct origin.
  await page.goto('/');
  await page.evaluate(
    ([key, payload]) => window.localStorage.setItem(key, payload),
    [STORAGE_KEY, JSON.stringify({ token: data.token, user: { userId: data.userId, rollNumber: data.rollNumber, role: data.role, sessionId: data.sessionId } })],
  );

  await page.context().storageState({ path: USER_FILE });
});

setup('create admin auth state', async ({ page, request }) => {
  fs.mkdirSync(path.dirname(ADMIN_FILE), { recursive: true });

  const rollNumber = process.env.TEST_ADMIN_ROLL ?? 'ADMIN001';
  const data = await apiLogin(request, rollNumber);

  await page.goto('/');
  await page.evaluate(
    ([key, payload]) => window.localStorage.setItem(key, payload),
    [STORAGE_KEY, JSON.stringify({ token: data.token, user: { userId: data.userId, rollNumber: data.rollNumber, role: data.role, sessionId: data.sessionId } })],
  );

  await page.context().storageState({ path: ADMIN_FILE });
});
