/**
 * login-spike.js — k6 spike test for the login endpoint
 *
 * Simulates a sudden burst of concurrent logins (e.g. students all opening
 * the app simultaneously before a quiz).  Validates that:
 *   - The rate limiter (10 req/min per IP) returns 429 gracefully
 *   - The server never returns 5xx errors
 *   - p95 response time stays under 2 s during the spike
 *
 * Usage:
 *   k6 run tests-load/scenarios/login-spike.js
 *   BASE_URL=http://localhost:3000 k6 run tests-load/scenarios/login-spike.js
 */

import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { Counter, Rate } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const loginErrors = new Counter('login_errors');
const rateLimited = new Counter('rate_limited');
const serverErrors = new Rate('server_error_rate');
const successRate = new Rate('success_rate');
const non429ClientErrors = new Counter('non_429_client_errors');

// ── Test data ─────────────────────────────────────────────────────────────────
const users = new SharedArray('users', () => {
  // CSV format: rollNumber
  const lines = open('../data/users.csv').split('\n').slice(1); // skip header
  return lines.filter(Boolean).map((line) => ({ rollNumber: line.trim() }));
});

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ── Scenario: spike ───────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 }, // ramp up to 50 VUs
        { duration: '30s', target: 50 }, // hold
        { duration: '10s', target: 0 },  // ramp down
      ],
    },
  },
  thresholds: {
    // Treat expected 429 as acceptable in spike mode and track real success KPI.
    success_rate: ['rate>0.95'],
    // But the API must still respond quickly
    http_req_duration: ['p(95)<2000'],
    // Near-zero 5xx errors
    server_error_rate: ['rate<0.01'],
  },
};

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];

  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ rollNumber: user.rollNumber }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  // 429 is expected under spike — it is NOT a failure
  if (res.status === 429) {
    rateLimited.add(1);
    successRate.add(true);
    serverErrors.add(0);
  } else if (res.status >= 500) {
    serverErrors.add(1);
    loginErrors.add(1);
    successRate.add(false);
  } else if (res.status >= 400) {
    non429ClientErrors.add(1);
    serverErrors.add(0);
    successRate.add(false);
  } else {
    const ok = check(res, {
      'login 200': (r) => r.status === 200,
      'token present': (r) => {
        try { return !!JSON.parse(r.body).token; } catch { return false; }
      },
    });
    successRate.add(ok);
    serverErrors.add(0);
  }

  sleep(0.5);
}
