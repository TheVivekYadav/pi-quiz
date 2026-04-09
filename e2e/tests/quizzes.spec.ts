/**
 * tests/quizzes.spec.ts
 *
 * Quizzes tab — list views for regular users and admins.
 */
import { test, expect } from '../fixtures/test';
import { QuizzesPage } from '../pages/QuizzesPage';
import { createTestQuiz, startTestQuiz } from '../fixtures/api';

test.describe('Quizzes tab — regular user', () => {
  test.beforeEach(async ({ page, userAuth, setAuthInBrowser }) => {
    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto('/(tabs)/quizzes');
  });

  test('shows "Upcoming Quizzes" heading', async ({ page }) => {
    const quizzesPage = new QuizzesPage(page);
    await quizzesPage.expectUpcomingHeading();
  });

  test('shows empty state when no quizzes exist', async ({ page }) => {
    await expect(
      page.getByText('No quizzes found', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows a quiz card after one is created and started', async ({
    page,
    adminToken,
    userAuth,
    setAuthInBrowser,
  }) => {
    // Create and immediately start a quiz via API
    const quiz = await createTestQuiz(adminToken, { title: 'Visible Quiz' });
    await startTestQuiz(adminToken, quiz.id);

    // Reload the quizzes tab
    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto('/(tabs)/quizzes');

    await expect(
      page.getByText('Visible Quiz', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a quiz card navigates to quiz detail', async ({
    page,
    adminToken,
    userAuth,
    setAuthInBrowser,
  }) => {
    const quiz = await createTestQuiz(adminToken, { title: 'Click Me Quiz' });
    await startTestQuiz(adminToken, quiz.id);

    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto('/(tabs)/quizzes');

    const quizzesPage = new QuizzesPage(page);
    await quizzesPage.openQuiz('Click Me Quiz');

    await expect(page).toHaveURL(new RegExp(`/quiz/${quiz.id}`), {
      timeout: 10_000,
    });
  });
});

test.describe('Quizzes tab — admin user', () => {
  test.beforeEach(async ({ page, adminAuth, setAuthInBrowser }) => {
    await page.goto('/');
    await setAuthInBrowser(adminAuth);
    await page.goto('/(tabs)/quizzes');
  });

  test('shows "All Quizzes" heading', async ({ page }) => {
    const quizzesPage = new QuizzesPage(page);
    await quizzesPage.expectAllQuizzesHeading();
  });

  test('shows "Past" badge on a quiz whose start time has passed', async ({
    page,
    adminAuth,
    adminToken,
    setAuthInBrowser,
  }) => {
    // Create a quiz with a past start time
    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 h ago
    await createTestQuiz(adminToken, {
      title: 'Past Quiz',
      startsAt: pastStart,
    });

    await page.goto('/');
    await setAuthInBrowser(adminAuth);
    await page.goto('/(tabs)/quizzes');

    const quizzesPage = new QuizzesPage(page);
    await quizzesPage.expectPastBadgeVisible();
  });
});
