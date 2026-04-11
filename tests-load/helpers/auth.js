/**
 * auth.js — k6 auth helper
 *
 * Returns a bearer token for the given roll number by calling
 * POST /auth/login on the API.  Intended to be used inside k6 setup()
 * or as part of a VU init section.
 */
import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Obtain a token for a roll number.  Fails the check (and the test) if
 * login does not return 200.
 *
 * @param {string} rollNumber
 * @returns {string|null} bearer token or null on failure
 */
export function getToken(rollNumber) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ rollNumber }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const ok = check(res, {
    'login 200': (r) => r.status === 200,
    'login has token': (r) => {
      try { return !!JSON.parse(r.body).token; } catch { return false; }
    },
  });

  if (!ok) return null;
  return JSON.parse(res.body).token;
}

/**
 * Build an Authorization header object for authenticated requests.
 *
 * @param {string} token
 */
export function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}
