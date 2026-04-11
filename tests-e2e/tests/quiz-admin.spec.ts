import { expect, test } from '@playwright/test';

/**
 * quiz-admin.spec.ts — admin-authenticated flows
 *
 * Runs under the 'chromium-admin-auth' project which pre-injects admin
 * storageState from .auth/admin.json, so no manual login is needed here.
 */

test('admin tab is visible for admin user', async ({ page }) => {
  await page.goto('/(tabs)');
  await expect(page.getByRole('tab', { name: /admin/i })).toBeVisible();
});

test('admin can navigate to create quiz page', async ({ page }) => {
  await page.goto('/(tabs)/admin');
  await expect(page).toHaveURL(/admin/);

  // Create quiz button should be present on the admin tab or accessible via nav
  const createBtn = page.getByRole('button', { name: /create quiz/i });
  await expect(createBtn).toBeVisible();
  await createBtn.click();
  await expect(page).toHaveURL(/create/);
});

test('admin can create a quiz end-to-end', async ({ page }) => {
  // 1. Navigate to create quiz
  await page.goto('/create-quiz');

  // 2. Fill quiz details
  const quizName = `Test Quiz ${Date.now()}`;
  await page.getByRole('textbox', { name: /title/i }).fill(quizName);
  await page.getByRole('textbox', { name: /topic/i }).fill('Physics');
  await page.getByRole('textbox', { name: /category/i }).fill('Science');
  await page.getByRole('textbox', { name: /description/i }).fill('Test description');
  await page.getByRole('textbox', { name: /curator note/i }).fill('Note');

  // Banner image upload button should be visible (optional step)
  await expect(page.getByRole('button', { name: /upload banner image/i })).toBeVisible();

  // 3. Proceed to next step
  await page.getByRole('button', { name: /create quiz and continue/i }).click();

  // 4. Add a form field
  await page.getByRole('button', { name: /add form field/i }).click();
  await page.getByRole('textbox', { name: /field label/i }).fill('Name');
  await page.getByRole('button', { name: /save form and add questions/i }).click();

  // 5. Add a question
  await page.getByRole('textbox', { name: /question 1/i }).fill('Sample question');
  await page.getByRole('textbox', { name: /question 1 option 1/i }).fill('Correct answer');
  await page.getByRole('textbox', { name: /question 1 option 2/i }).fill('Wrong answer');
  await page.getByRole('textbox', { name: /question 1 option 3/i }).fill('Wrong answer');
  await page.getByRole('textbox', { name: /question 1 option 4/i }).fill('Wrong answer');

  // 6. Publish
  await page.getByRole('button', { name: /save questions and publish/i }).click();

  await expect(page.getByText('Back to Dashboard')).toBeVisible();
});

test('admin quizzes list shows all quizzes', async ({ page }) => {
  await page.goto('/(tabs)/quizzes');
  await expect(page.getByText(/all quizzes/i)).toBeVisible();
});
