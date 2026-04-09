/**
 * tests/admin.spec.ts
 *
 * Admin tab behaviour:
 *   - Non-admin users see "Access denied".
 *   - Admin can list, create (via UI or API), and delete quizzes.
 *   - Admin can view user sessions and block/unblock them.
 */
import { test, expect } from '../fixtures/test';
import { createTestQuiz } from '../fixtures/api';
import { AdminPage } from '../pages/AdminPage';

test.describe('Admin tab — non-admin user', () => {
  test('shows "Access denied" message', async ({
    page,
    userAuth,
    setAuthInBrowser,
  }) => {
    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto('/(tabs)/admin');

    const adminPage = new AdminPage(page);
    await adminPage.expectAccessDenied();
  });
});

test.describe('Admin tab — admin user', () => {
  test.beforeEach(async ({ page, adminAuth, setAuthInBrowser }) => {
    await page.goto('/');
    await setAuthInBrowser(adminAuth);
    await page.goto('/(tabs)/admin');
  });

  test('shows the admin console heading', async ({ page }) => {
    const adminPage = new AdminPage(page);
    await adminPage.expectAdminConsole();
  });

  test('lists a quiz created via API', async ({ page, adminToken }) => {
    await createTestQuiz(adminToken, { title: 'Admin Listed Quiz' });

    // Reload to pick up new quiz
    await page.reload();

    const adminPage = new AdminPage(page);
    await adminPage.expectQuizInList('Admin Listed Quiz');
  });

  test('can delete a quiz from the list', async ({ page, adminToken }) => {
    await createTestQuiz(adminToken, { title: 'Delete Me Quiz' });
    await page.reload();

    const adminPage = new AdminPage(page);
    await adminPage.expectQuizInList('Delete Me Quiz');

    // Intercept the browser confirm dialog that appears on delete
    page.once('dialog', (dialog) => dialog.accept());
    await adminPage.deleteQuiz('Delete Me Quiz');

    // The quiz card should disappear (the component removes it from state)
    await adminPage.expectQuizAbsent('Delete Me Quiz');
  });

  test('admin user sessions section is visible', async ({ page }) => {
    await expect(
      page.getByText('User Sessions', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('search filters user list', async ({ page }) => {
    const adminPage = new AdminPage(page);

    // There should be at least the seeded users
    await adminPage.searchUser('ADMIN001');
    await expect(
      page.getByText('ADMIN001', { exact: false }),
    ).toBeVisible({ timeout: 5_000 });

    // Search for a non-existent roll — list should become empty
    await adminPage.searchUser('NONEXISTENT_ROLL_XYZ');
    await expect(
      page.getByText('No users found', { exact: false }),
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Admin API — access control', () => {
  test('non-admin gets 403 on admin-only endpoints', async ({ userToken }) => {
    const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

    const res = await fetch(`${API_URL}/quiz/admin/list`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(403);
  });

  test('unauthenticated request gets 400 on protected endpoints', async () => {
    const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

    const res = await fetch(`${API_URL}/quiz/home`);
    expect(res.status).toBe(400);
  });
});
