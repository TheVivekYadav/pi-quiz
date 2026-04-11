/**
 * quiz-lifecycle.spec.ts — Full quiz lifecycle with 5 users (pure-API test)
 *
 * This test exercises the complete lifecycle end-to-end:
 *   0. Admin authenticates
 *   1. Admin creates a quiz
 *   2. Admin sets an enrollment form
 *   3. Admin adds 5 questions
 *   4. Admin starts the quiz immediately
 *   5. 5 users enroll in parallel
 *   6. 5 users submit answers in parallel
 *   7. Admin declares winners
 *   8. Admin fetches the report and all stats are validated
 *   9. Results are written to fixtures/quiz-lifecycle-results.json
 *
 * All test data is pre-seeded in fixtures/quiz-seed.json so scores are
 * fully deterministic and cross-validated at assertion time.
 *
 * Score distribution (each question = 2 pts, 5 questions → max 10):
 *   TEST001 → 10, TEST002 → 8, TEST003 → 8, TEST004 → 6, TEST005 → 4
 *   Ties share the same rank in the backend and are displayed by submission time.
 *
 * Expected average (before DB rounding): 36/5 = 7.2  →  Math.round = 7
 *
 * NOTE on is_completed:
 *   The backend marks a user as completed only after MAX_ATTEMPTS (2)
 *   submissions.  Each user submits once here, so stats.totalCompleted
 *   will be 0 — this is correct API behaviour and is asserted explicitly.
 */

import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ── Paths ─────────────────────────────────────────────────────────────────────

const SEED_FILE    = path.join(__dirname, '../fixtures/quiz-seed.json');
const RESULTS_FILE = path.join(__dirname, '../fixtures/quiz-lifecycle-results.json');
const LIFECYCLE_USER_COUNT = 5;

// ── Seed data ─────────────────────────────────────────────────────────────────

interface SeedQuestion {
  placeholder: string;
  text: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  points: number;
}

interface SeedUser {
  rollNumber: string;
  name: string;
  branch: string;
}

interface Seed {
  quiz: {
    title: string;
    topic: string;
    category: string;
    level: string;
    durationMinutes: number;
    description: string;
    curatorNote: string;
  };
  enrollmentForm: { fields: object[] };
  questions: SeedQuestion[];
  users: SeedUser[];
  answerPattern: Record<string, Array<'correct' | 'wrong'>>;
}

const seed: Seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));

// ── Shared state (populated as the serial steps run) ─────────────────────────

interface QuestionEntry {
  realId: string;
  correctOptionId: string;
  /** First option whose id ≠ correctOptionId */
  wrongOptionId: string;
}

const state = {
  adminToken:    '',
  quizId:        '',                             // short_id returned by createQuiz
  questionMap:   [] as QuestionEntry[],
  userTokens:    {} as Record<string, string>,   // rollNumber → token
  submitResults: {} as Record<string, { score: number; total: number; accuracyRate: number; badge: string; percentile: number }>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }
  const timestamp = Date.parse(raw);
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  }
  return null;
}

/** POST /api/auth/login and return the bearer token. */
async function apiLogin(
  request: import('@playwright/test').APIRequestContext,
  rollNumber: string,
): Promise<string> {
  const maxAttempts = 20;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await request.post('/api/auth/login', {
      data: { rollNumber },
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok()) {
      const body = await res.json() as { token: string };
      expect(body.token, `No token for ${rollNumber}`).toBeTruthy();
      return body.token;
    }

    if (res.status() !== 429 || attempt === maxAttempts) {
      expect(res.ok(), `Login failed for ${rollNumber}: ${res.status()} ${await res.text()}`).toBeTruthy();
      break;
    }

    const retryAfterSec = parseRetryAfterSeconds(res.headers()['retry-after'] ?? null);
    const backoffMs = retryAfterSec
      ? retryAfterSec * 1000
      : Math.min(10_000, 800 * 2 ** (attempt - 1));
    const jitterMs = Math.floor(Math.random() * 400);
    await sleep(backoffMs + jitterMs);
  }

  throw new Error(`Login retry exhausted for ${rollNumber}`);
}

/** Build Authorization header object. */
function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * Resolve a user's answer map using the real question IDs obtained after
 * questions were created.
 *
 * @param pattern  Array of 'correct'|'wrong' — one entry per question in order
 */
function buildAnswers(pattern: Array<'correct' | 'wrong'>): Record<string, string> {
  return Object.fromEntries(
    state.questionMap.map((q, i) => [
      q.realId,
      pattern[i] === 'correct' ? q.correctOptionId : q.wrongOptionId,
    ]),
  );
}

/** Expected score for a given answer pattern (each correct = 2 pts). */
function expectedScore(pattern: Array<'correct' | 'wrong'>): number {
  return pattern.filter(p => p === 'correct').length * 2;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => runWorker(),
  );

  await Promise.all(workers);
  return results;
}

// ── Serial test steps ─────────────────────────────────────────────────────────

test.describe.serial('Quiz Full Lifecycle — 50 Users', () => {

  // ── Step 0: Admin authenticates ──────────────────────────────────────────

  test('Step 0: admin authenticates', async ({ request }) => {
    const adminRoll = process.env.TEST_ADMIN_ROLL ?? 'ADMIN001';
    state.adminToken = await apiLogin(request, adminRoll);
    expect(state.adminToken).toBeTruthy();
  });

  // ── Step 1: Admin creates quiz ────────────────────────────────────────────

  test('Step 1: admin creates quiz', async ({ request }) => {
    // Use a start time 1 hour in the future; Step 4 will move it to NOW via /start
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const res = await request.post('/api/quiz', {
      data: { ...seed.quiz, startsAt },
      headers: auth(state.adminToken),
    });

    expect(res.ok(), `createQuiz failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    const body = await res.json() as { id: string; title: string; startsAtIso: string };
    expect(body).toHaveProperty('id');
    expect(body.title).toBe(seed.quiz.title);
    expect(body).toHaveProperty('startsAtIso');

    state.quizId = body.id;   // short_id
    expect(state.quizId).toBeTruthy();
  });

  // ── Step 2: Admin sets enrollment form ───────────────────────────────────

  test('Step 2: admin sets enrollment form', async ({ request }) => {
    const res = await request.post(`/api/quiz/${state.quizId}/enrollment-form`, {
      data: { fields: seed.enrollmentForm.fields },
      headers: auth(state.adminToken),
    });

    expect(res.ok(), `setEnrollmentForm failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    const body = await res.json() as { formId: string; fields: Array<{ id: string }> };
    expect(body).toHaveProperty('formId');
    expect(body.formId).toBeTruthy();
    expect(Array.isArray(body.fields)).toBe(true);
    expect(body.fields.length).toBe(seed.enrollmentForm.fields.length);
  });

  // ── Step 3: Admin adds 5 questions ────────────────────────────────────────

  test('Step 3: admin adds 5 questions', async ({ request }) => {
    for (const q of seed.questions) {
      const res = await request.post(`/api/quiz/${state.quizId}/questions`, {
        data: {
          text:            q.text,
          options:         q.options,
          correctOptionId: q.correctOptionId,
          points:          q.points,
        },
        headers: auth(state.adminToken),
      });

      expect(
        res.ok(),
        `addQuestion (${q.placeholder}) failed: ${res.status()} ${await res.text()}`,
      ).toBeTruthy();

      const body = await res.json() as { id: string; options: { id: string; label: string }[] };
      expect(body).toHaveProperty('id');
      expect(body.id).toBeTruthy();

      // Identify a wrong option (first option whose id ≠ correctOptionId)
      const wrongOption = body.options.find(o => o.id !== q.correctOptionId);
      expect(wrongOption, `No wrong option found for ${q.placeholder}`).toBeDefined();

      state.questionMap.push({
        realId:          body.id,
        correctOptionId: q.correctOptionId,
        wrongOptionId:   wrongOption!.id,
      });
    }

    expect(state.questionMap).toHaveLength(5);
  });

  // ── Step 4: Admin starts quiz immediately ────────────────────────────────

  test('Step 4: admin starts quiz immediately', async ({ request }) => {
    const res = await request.post(`/api/quiz/${state.quizId}/start`, {
      headers: auth(state.adminToken),
    });

    expect(res.ok(), `startQuiz failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  // ── Step 5: 5 users enroll in parallel ───────────────────────────────────

  test('Step 5: 5 users enroll in parallel', async ({ request }) => {
    test.setTimeout(120_000);

    const users = seed.users.slice(0, LIFECYCLE_USER_COUNT);

    const results = await mapWithConcurrency(users, 5, async user => {
        // Each user logs in to obtain their token
        const token = await apiLogin(request, user.rollNumber);
        state.userTokens[user.rollNumber] = token;

        const res = await request.post(`/api/quiz/${state.quizId}/enroll`, {
          data: {
            formAnswers: { name: user.name, branch: user.branch },
          },
          headers: auth(token),
        });

        return {
          rollNumber: user.rollNumber,
          status:     res.status(),
          body:       await res.json() as { success: boolean; message: string },
        };
    });

    // Validate all enrollments
    for (const r of results) {
      expect(
        r.body.success,
        `Enrollment failed for ${r.rollNumber}: ${JSON.stringify(r.body)}`,
      ).toBe(true);
      expect(r.body.message).toMatch(/enrolled/i);
    }

    expect(results).toHaveLength(LIFECYCLE_USER_COUNT);
  });

  // ── Step 6: 5 users submit answers in parallel ───────────────────────────

  test('Step 6: 5 users submit answers in parallel', async ({ request }) => {
    test.setTimeout(120_000);

    const startedAt = new Date().toISOString();
    const users = seed.users.slice(0, LIFECYCLE_USER_COUNT);

    const results = await mapWithConcurrency(users, 5, async user => {
        const pattern = seed.answerPattern[user.rollNumber];
        const answers = buildAnswers(pattern);
        const token   = state.userTokens[user.rollNumber];

        const res = await request.post(`/api/quiz/${state.quizId}/submit`, {
          data: { answers, startedAt },
          headers: auth(token),
        });

        expect(
          res.ok(),
          `Submit failed for ${user.rollNumber}: ${res.status()} ${await res.text()}`,
        ).toBeTruthy();

        const body = await res.json() as {
          score: number; total: number; accuracyRate: number; badge: string; percentile: number;
        };
        state.submitResults[user.rollNumber] = body;

        return { rollNumber: user.rollNumber, body };
    });

    // Validate every submission
    for (const { rollNumber, body } of results) {
      const pattern = seed.answerPattern[rollNumber];
      const expected = expectedScore(pattern);

      expect(body.total).toBe(10);
      expect(body.score).toBeGreaterThanOrEqual(0);
      expect(body.score).toBeLessThanOrEqual(10);
      expect(body.score).toBe(expected);
      expect(body.badge).toBeTruthy();
      expect(body.percentile).toBeGreaterThanOrEqual(1);
    }

    expect(results).toHaveLength(LIFECYCLE_USER_COUNT);
  });

  // ── Step 7: Admin declares winners ───────────────────────────────────────

  test('Step 7: admin declares winners', async ({ request }) => {
    const res = await request.post(`/api/quiz/${state.quizId}/declare-winners`, {
      headers: auth(state.adminToken),
    });

    expect(
      res.ok(),
      `declareWinners failed: ${res.status()} ${await res.text()}`,
    ).toBeTruthy();

    const body = await res.json() as {
      success: boolean;
      quizTitle: string;
      winners: Array<{ rank: number; rollNumber: string; score: number }>;
    };

    expect(body.success).toBe(true);
    expect(body.quizTitle).toBe(seed.quiz.title);
    expect(body.winners.length).toBeGreaterThanOrEqual(1);
    expect(body.winners.length).toBeLessThanOrEqual(3);
    const winnerRollNumbers = body.winners.map((winner) => winner.rollNumber);
    expect(winnerRollNumbers).toContain('TEST001');
    expect(winnerRollNumbers).toContain('TEST002');
    expect(winnerRollNumbers).toContain('TEST003');
    expect(body.winners.find((winner) => winner.rollNumber === 'TEST001')?.score).toBe(10);
    expect(body.winners.find((winner) => winner.rollNumber === 'TEST001')?.rank).toBe(1);
    expect(body.winners.find((winner) => winner.rollNumber === 'TEST002')?.score).toBe(8);
    expect(body.winners.find((winner) => winner.rollNumber === 'TEST002')?.rank).toBe(2);
    expect(body.winners.find((winner) => winner.rollNumber === 'TEST003')?.score).toBe(8);
    expect(body.winners.find((winner) => winner.rollNumber === 'TEST003')?.rank).toBe(2);
  });

  // ── Step 8: Admin fetches report and validates stats ─────────────────────

  test('Step 8: admin fetches report and validates', async ({ request }) => {
    const res = await request.get(`/api/quiz/${state.quizId}/report`, {
      headers: auth(state.adminToken),
    });

    expect(
      res.ok(),
      `getReport failed: ${res.status()} ${await res.text()}`,
    ).toBeTruthy();

    const body = await res.json() as {
      quiz: {
        id: string;
        title: string;
        winnersDeclared: boolean;
        winnersDeclaredAt: string | null;
      };
      stats: {
        totalEnrolled: number;
        totalCompleted: number;
        totalAttempts: number;
        avgScore: number;
        maxScore: number;
      };
      topScorers: Array<{ rank: number; rollNumber: string; score: number }>;
      winners: {
        declared: boolean;
        quizTitle: string;
        winners: Array<{ rank: number; rollNumber: string; score: number }>;
      };
    };

    // ── Quiz section ──────────────────────────────────────────────────────
    expect(body.quiz.title).toBe(seed.quiz.title);
    expect(body.quiz.winnersDeclared).toBe(true);
    expect(body.quiz.winnersDeclaredAt).not.toBeNull();

    // ── Stats section ─────────────────────────────────────────────────────
    expect(body.stats.totalEnrolled).toBe(LIFECYCLE_USER_COUNT);
    expect(body.stats.totalAttempts).toBe(LIFECYCLE_USER_COUNT);

    // totalCompleted = 0: each user submitted once; the backend marks
    // is_completed only after MAX_ATTEMPTS (2) submissions.
    expect(body.stats.totalCompleted).toBe(0);

    expect(body.stats.maxScore).toBe(10);

    expect(body.stats.avgScore).toBe(7);

    // ── Top scorers section ───────────────────────────────────────────────
    expect(body.topScorers.length).toBeGreaterThan(0);
    expect(body.topScorers.length).toBeLessThanOrEqual(10);

    // Top scorers should preserve shared ranks for ties.
    const topScorersByRoll = new Map(body.topScorers.map((row) => [row.rollNumber, row]));
    expect(topScorersByRoll.get('TEST001')?.score).toBe(10);
    expect(topScorersByRoll.get('TEST001')?.rank).toBe(1);
    expect(topScorersByRoll.get('TEST002')?.score).toBe(8);
    expect(topScorersByRoll.get('TEST002')?.rank).toBe(2);
    expect(topScorersByRoll.get('TEST003')?.score).toBe(8);
    expect(topScorersByRoll.get('TEST003')?.rank).toBe(2);
    expect(body.topScorers.filter((row) => row.score === 8)).toHaveLength(2);

    // ── Winners section ───────────────────────────────────────────────────
    expect(body.winners.declared).toBe(true);
    expect(body.winners.winners.length).toBeGreaterThanOrEqual(1);
    expect(body.winners.winners.map((winner) => winner.rollNumber)).toEqual(
      expect.arrayContaining(['TEST001', 'TEST002', 'TEST003'])
    );
    expect(body.winners.winners.find((winner) => winner.rollNumber === 'TEST001')?.rank).toBe(1);
    expect(body.winners.winners.find((winner) => winner.rollNumber === 'TEST002')?.rank).toBe(2);
    expect(body.winners.winners.find((winner) => winner.rollNumber === 'TEST003')?.rank).toBe(2);

    // ── Persist results ───────────────────────────────────────────────────
    const results = {
      quizId:         state.quizId,
      totalEnrolled:  body.stats.totalEnrolled,
      totalCompleted: body.stats.totalCompleted,
      totalAttempts:  body.stats.totalAttempts,
      avgScore:       body.stats.avgScore,
      maxScore:       body.stats.maxScore,
      winnersDeclared: body.quiz.winnersDeclared,
      winners:        body.winners.winners,
      topScorers:     body.topScorers,
      validatedAt:    new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  });

  // ── Step 9: Verify results file was written ───────────────────────────────

  test('Step 9: results file is written and valid', () => {
    expect(fs.existsSync(RESULTS_FILE), 'Results file was not written').toBe(true);

    const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8')) as {
      quizId: string;
      totalEnrolled: number;
      totalAttempts: number;
      maxScore: number;
      winnersDeclared: boolean;
      validatedAt: string;
    };

    expect(results.quizId).toBeTruthy();
    expect(results.totalEnrolled).toBe(LIFECYCLE_USER_COUNT);
    expect(results.totalAttempts).toBe(LIFECYCLE_USER_COUNT);
    expect(results.maxScore).toBe(10);
    expect(results.winnersDeclared).toBe(true);
    expect(results.validatedAt).toBeTruthy();
  });
});
