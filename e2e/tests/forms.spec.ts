/**
 * tests/forms.spec.ts
 *
 * Enrollment form behaviour:
 *   - A quiz with an enrollment form shows the fields before the "Enroll" button.
 *   - Submitting with a missing required field shows a validation error.
 *   - Filling all required fields allows enrollment to proceed.
 */
import { test, expect } from '../fixtures/test';
import {
  addTestQuestion,
  createTestQuiz,
  setEnrollmentForm,
  startTestQuiz,
} from '../fixtures/api';
import { QuizDetailPage } from '../pages/QuizDetailPage';

test.describe('Enrollment forms', () => {
  test('quiz with an enrollment form shows form fields', async ({
    page,
    adminToken,
    userAuth,
    setAuthInBrowser,
  }) => {
    // Create quiz + add an enrollment form via API
    const quiz = await createTestQuiz(adminToken, { title: 'Form Quiz' });
    await addTestQuestion(adminToken, quiz.id);
    await setEnrollmentForm(adminToken, quiz.id, [
      { id: 'college', label: 'College Name', type: 'text', required: true },
      {
        id: 'year',
        label: 'Year',
        type: 'select',
        options: ['1st', '2nd', '3rd', '4th'],
        required: true,
      },
    ]);
    await startTestQuiz(adminToken, quiz.id);

    // Visit the quiz detail page as a regular user
    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto(`/quiz/${quiz.id}`);

    // The enrollment form section should be visible
    await expect(
      page.getByText('College Name', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Year', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('submitting with a missing required field shows a validation error', async ({
    page,
    adminToken,
    userAuth,
    setAuthInBrowser,
  }) => {
    const quiz = await createTestQuiz(adminToken, { title: 'Required Field Quiz' });
    await addTestQuestion(adminToken, quiz.id);
    await setEnrollmentForm(adminToken, quiz.id, [
      { id: 'college', label: 'College Name', type: 'text', required: true },
    ]);
    await startTestQuiz(adminToken, quiz.id);

    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto(`/quiz/${quiz.id}`);

    // Click enroll without filling the required field
    await page.getByRole('button', { name: /enroll now|join now/i }).click();

    // The app shows an Alert — on web this renders via react-native-web which
    // typically falls back to window.alert; Playwright intercepts it.
    // Check for either an alert dialog or an inline error text.
    const hasDialog = await page
      .waitForEvent('dialog', { timeout: 3_000 })
      .then((d) => {
        expect(d.message()).toMatch(/required/i);
        d.dismiss().catch(() => {});
        return true;
      })
      .catch(() => false);

    if (!hasDialog) {
      await expect(
        page.getByText(/required/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('filling all required fields allows enrollment to proceed', async ({
    page,
    adminToken,
    userAuth,
    setAuthInBrowser,
  }) => {
    const quiz = await createTestQuiz(adminToken, { title: 'Full Form Quiz' });
    await addTestQuestion(adminToken, quiz.id);
    await setEnrollmentForm(adminToken, quiz.id, [
      { id: 'college', label: 'College Name', type: 'text', required: true },
    ]);
    await startTestQuiz(adminToken, quiz.id);

    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto(`/quiz/${quiz.id}`);

    const detailPage = new QuizDetailPage(page);

    // Fill required field
    await detailPage.fillEnrollmentField('College Name', 'Test College');

    // Enroll — should navigate to the lobby
    await detailPage.enrollInQuiz();
    await page.waitForURL(/\/lobby/, { timeout: 10_000 });
    await detailPage.expectLobby();
  });
});
