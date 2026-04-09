/**
 * tests/quiz-flow.spec.ts
 *
 * Happy-path end-to-end: admin creates a quiz → starts it → user enrolls →
 * answers questions → submits → admin declares winners → user sees winners.
 */
import { test, expect } from '../fixtures/test';
import {
  addTestQuestion,
  createTestQuiz,
  enrollInQuiz,
  startTestQuiz,
  submitQuiz,
  declareWinners,
} from '../fixtures/api';
import { QuizDetailPage } from '../pages/QuizDetailPage';

test.describe('Full quiz flow', () => {
  test('user can complete a quiz and admin can declare winners', async ({
    page,
    adminToken,
    adminAuth,
    userToken,
    userAuth,
    setAuthInBrowser,
  }) => {
    // ── 1. Admin creates a quiz and adds a question via API ──────────────────
    const quiz = await createTestQuiz(adminToken, {
      title: 'Flow Test Quiz',
      durationMinutes: 5,
      // Start time is in the past so it's immediately active once started
      startsAt: new Date(Date.now() - 5_000).toISOString(),
    });

    const question = await addTestQuestion(adminToken, quiz.id, {
      text: 'What is 2 + 2?',
      options: [
        { id: 'a', label: '3' },
        { id: 'b', label: '4' },
        { id: 'c', label: '5' },
        { id: 'd', label: '6' },
      ],
      correctOptionId: 'b',
    });

    // ── 2. Admin starts the quiz ─────────────────────────────────────────────
    await startTestQuiz(adminToken, quiz.id);

    // ── 3. User enrolls and enters the lobby (via API, skipping form) ────────
    await enrollInQuiz(userToken, quiz.id);

    // ── 4. User navigates to the lobby via browser ───────────────────────────
    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto(`/quiz/${quiz.id}/lobby`);

    const detailPage = new QuizDetailPage(page);
    await detailPage.expectLobby();

    // ── 5. Start the quiz (button should be enabled — quiz is already active) ─
    await detailPage.startQuiz();
    await page.waitForURL(/\/question\/1/, { timeout: 15_000 });

    // ── 6. Answer the single question ────────────────────────────────────────
    await detailPage.answerQuestion('4'); // correct answer

    // ── 7. Expect the result screen ───────────────────────────────────────────
    await detailPage.expectScore();

    // ── 8. Admin declares winners (via API) ───────────────────────────────────
    await declareWinners(adminToken, quiz.id);

    // ── 9. User navigates to winners page ────────────────────────────────────
    await page.goto(`/quiz/${quiz.id}/winners`);
    await detailPage.expectWinnersDeclared();
  });

  test('user sees score and accuracy on the result screen after submitting', async ({
    page,
    adminToken,
    userToken,
    userAuth,
    setAuthInBrowser,
  }) => {
    const quiz = await createTestQuiz(adminToken, {
      title: 'Score Check Quiz',
      startsAt: new Date(Date.now() - 5_000).toISOString(),
    });
    const question = await addTestQuestion(adminToken, quiz.id);
    await startTestQuiz(adminToken, quiz.id);
    await enrollInQuiz(userToken, quiz.id);

    // Submit answers via API to avoid timing issues with the per-question timer
    await submitQuiz(
      userToken,
      quiz.id,
      { [question.id]: 'b' }, // correct answer
      new Date().toISOString(),
    );

    // Navigate to the result page
    await page.goto('/');
    await setAuthInBrowser(userAuth);
    await page.goto(`/quiz/${quiz.id}/result`);

    const detailPage = new QuizDetailPage(page);
    await detailPage.expectScore();
  });
});
