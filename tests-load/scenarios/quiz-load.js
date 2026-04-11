/**
 * quiz-load.js — k6 steady-state load test
 *
 * Simulates a realistic user session:
 *   1. Login → get token
 *   2. Fetch quiz home
 *   3. Pick a random quiz and fetch its detail
 *
 * 20 VUs for 2 minutes — baseline to confirm the API handles normal
 * concurrent usage within SLA (p95 < 500 ms, error rate < 1 %).
 *
 * Usage:
 *   k6 run tests-load/scenarios/quiz-load.js
 *   BASE_URL=http://localhost:3000 k6 run tests-load/scenarios/quiz-load.js
 */

import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { getToken, authHeaders, BASE_URL } from '../helpers/auth.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const quizLoadErrors = new Counter('quiz_load_errors');
const homePageDuration = new Trend('home_page_duration', true);

// ── Test data ─────────────────────────────────────────────────────────────────
const users = new SharedArray('users', () => {
  const lines = open('../data/users.csv').split('\n').slice(1);
  return lines.filter(Boolean).map((line) => ({ rollNumber: line.trim() }));
});

// ── Options ───────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],        // < 1 % error rate
    http_req_duration: ['p(95)<500'],      // p95 < 500 ms
    home_page_duration: ['p(95)<500'],
  },
};

// ── VU script ─────────────────────────────────────────────────────────────────
export default function () {
  const user = users[Math.floor(Math.random() * users.length)];

  // 1. Login
  const token = getToken(user.rollNumber);
  if (!token) {
    quizLoadErrors.add(1);
    return;
  }

  sleep(0.5);

  // 2. Fetch quiz home
  const homeStart = Date.now();
  const homeRes = http.get(`${BASE_URL}/quiz/home`, authHeaders(token));
  homePageDuration.add(Date.now() - homeStart);

  const homeOk = check(homeRes, {
    'quiz home 200': (r) => r.status === 200,
  });

  if (!homeOk) {
    quizLoadErrors.add(1);
    return;
  }

  sleep(1);

  // 3. Fetch a random quiz detail if any quizzes are returned
  let quizzes = [];
  try {
    const body = JSON.parse(homeRes.body);
    quizzes = body.featuredQuizzes ?? body.featured ?? body.quizzes ?? [];
  } catch {
    // Non-JSON body — skip quiz detail step
  }

  if (quizzes.length > 0) {
    const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
    const detailRes = http.get(`${BASE_URL}/quiz/${quiz.id}`, authHeaders(token));

    check(detailRes, {
      'quiz detail 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
