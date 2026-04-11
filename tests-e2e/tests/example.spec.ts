import { expect, test } from '@playwright/test';

// test('has title', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Expect a title "to contain" a substring.
//   await expect(page).toHaveTitle(/Playwright/);
// });

// test('get started link', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Click the get started link.
//   await page.getByRole('link', { name: 'Get started' }).click();

//   // Expects page to have a heading with the name of Installation.
//   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
// });


test('homepage loads', async ({page})=>{
  await page.goto('/login');

  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
})

test('admin can create quiz', async ({ page }) => {
  // 1. Login
  await page.goto('/login');

  await page.getByRole('textbox', { name: /roll number/i }).fill('ADMIN001');
  await page.getByRole('button', { name: /sign in with roll number/i }).click();

  // Assert login success
  await expect(page).toHaveURL(/dashboard|admin/);

  // 2. Navigate to create quiz
  await page.getByRole('tab', { name: /Admin/i }).click();
  await page.getByRole('button', { name: /create quiz/i }).click();

  // 3. Fill quiz details
  const quizName = `Test Quiz ${Date.now()}`;

  await page.getByRole('textbox', { name: /title/i }).fill(quizName);
  await page.getByRole('textbox', { name: /topic/i }).fill('Physics');
  await page.getByRole('textbox', { name: /category/i }).fill('Science');

  await page.getByRole('textbox', { name: /description/i }).fill('Test description');
  await page.getByRole('textbox', { name: /curator note/i }).fill('Note');

  // 4. Banner image is optional; the button now has a stable role if needed.
  await expect(page.getByRole('button', { name: /upload banner image/i })).toBeVisible();

  // 5. Next step
  await page.getByRole('button', { name: /create quiz and continue/i }).click();

  // 6. Add form field
  await page.getByRole('button', { name: /add form field/i }).click();
  await page.getByRole('textbox', { name: /field label/i }).fill('Name');

  await page.getByRole('button', { name: /save form and add questions/i }).click();

  // 7. Add question
  await page.getByRole('textbox', { name: /question 1/i }).fill('Sample question');

  await page.getByRole('textbox', { name: /question 1 option 1/i }).fill('Correct answer');
  await page.getByRole('textbox', { name: /question 1 option 2/i }).fill('Wrong answer');
  await page.getByRole('textbox', { name: /question 1 option 3/i }).fill('Wrong answer');
  await page.getByRole('textbox', { name: /question 1 option 4/i }).fill('Wrong answer');

  // 8. Publish
  await page.getByRole('button', { name: /save questions and publish/i }).click();

  // ✅ FINAL ASSERTION (VERY IMPORTANT)
  await expect(page.getByText('Back to Dashboard')).toBeVisible();
});



