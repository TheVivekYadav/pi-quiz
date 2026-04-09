/**
 * fixtures/api.ts
 *
 * Thin wrappers around the NestJS REST API used in tests to set up / tear down
 * state without going through the UI (keeps tests fast and decoupled).
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  token: string;
  userId: number;
  rollNumber: string;
  role: 'admin' | 'user';
  sessionId: string;
}

export interface QuizResult {
  id: string;
  title: string;
  category: string;
  level: string;
  startsAtIso: string;
  durationMinutes: number;
}

export interface QuestionResult {
  id: string;
  text: string;
}

export interface CreateQuizInput {
  title: string;
  topic: string;
  category: string;
  level: string;
  durationMinutes: number;
  /** ISO-8601 string */
  startsAt: string;
  description?: string;
  expectations?: string;
  curatorNote?: string;
}

export interface AddQuestionInput {
  text: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  points?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiDelete<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Log in with the given roll number and return the auth token payload. */
export async function loginAs(
  rollNumber: string,
  name?: string,
): Promise<AuthResult> {
  return apiPost<AuthResult>('/auth/login', {
    rollNumber,
    name: name ?? rollNumber,
    deviceName: 'e2e-test',
    platform: 'web',
  });
}

/** Log in as the seeded admin (ADMIN001). */
export async function loginAsAdmin(): Promise<AuthResult> {
  const adminRoll = process.env.E2E_ADMIN_ROLL ?? 'ADMIN001';
  return loginAs(adminRoll, 'Admin User');
}

/** Log in as the seeded regular user (TESTUSER001). */
export async function loginAsUser(): Promise<AuthResult> {
  const userRoll = process.env.E2E_USER_ROLL ?? 'TESTUSER001';
  return loginAs(userRoll, 'Test User');
}

/** Log out (revoke session). */
export async function logoutToken(token: string): Promise<void> {
  await apiPost<{ success: boolean }>('/auth/logout', {}, token);
}

// ─── Quiz management (admin) ──────────────────────────────────────────────────

/** Create a quiz and return its ID + metadata. */
export async function createTestQuiz(
  adminToken: string,
  overrides?: Partial<CreateQuizInput>,
): Promise<QuizResult> {
  const payload: CreateQuizInput = {
    title: 'E2E Test Quiz',
    topic: 'Testing',
    category: 'Science',
    level: 'Beginner',
    durationMinutes: 5,
    // Starts 1 minute in the future so it can be "started" by admin
    startsAt: new Date(Date.now() + 60_000).toISOString(),
    description: 'A quiz created by E2E tests.',
    ...overrides,
  };
  return apiPost<QuizResult>('/quiz', payload, adminToken);
}

/** Add a question to a quiz. Returns the question record. */
export async function addTestQuestion(
  adminToken: string,
  quizId: string,
  overrides?: Partial<AddQuestionInput>,
): Promise<QuestionResult> {
  const payload: AddQuestionInput = {
    text: 'What is 2 + 2?',
    options: [
      { id: 'a', label: '3' },
      { id: 'b', label: '4' },
      { id: 'c', label: '5' },
      { id: 'd', label: '6' },
    ],
    correctOptionId: 'b',
    points: 1,
    ...overrides,
  };
  return apiPost<QuestionResult>(`/quiz/${quizId}/questions`, payload, adminToken);
}

/** Start a quiz immediately (sets starts_at to now). */
export async function startTestQuiz(
  adminToken: string,
  quizId: string,
): Promise<void> {
  await apiPost<{ success: boolean }>(`/quiz/${quizId}/start`, {}, adminToken);
}

/** Declare winners for a quiz. */
export async function declareWinners(
  adminToken: string,
  quizId: string,
): Promise<void> {
  await apiPost<unknown>(`/quiz/${quizId}/declare-winners`, {}, adminToken);
}

/** Delete a quiz. */
export async function deleteQuiz(
  adminToken: string,
  quizId: string,
): Promise<void> {
  await apiDelete<{ success: boolean }>(`/quiz/${quizId}`, adminToken);
}

// ─── User quiz actions ────────────────────────────────────────────────────────

/** Enroll the authenticated user in a quiz. */
export async function enrollInQuiz(
  userToken: string,
  quizId: string,
  formAnswers?: Record<string, string>,
): Promise<void> {
  await apiPost<{ success: boolean; message: string }>(
    `/quiz/${quizId}/enroll`,
    { formAnswers: formAnswers ?? {} },
    userToken,
  );
}

/** Fetch the list of upcoming quizzes visible to a user. */
export async function fetchUpcomingQuizzes(userToken: string): Promise<QuizResult[]> {
  return apiGet<QuizResult[]>('/quiz/upcoming', userToken);
}

/** Fetch all quizzes (admin). */
export async function fetchAdminQuizList(adminToken: string): Promise<QuizResult[]> {
  return apiGet<QuizResult[]>('/quiz/admin/list', adminToken);
}

/** Submit answers for a quiz. */
export async function submitQuiz(
  userToken: string,
  quizId: string,
  answers: Record<string, string>,
  startedAt?: string,
): Promise<unknown> {
  return apiPost<unknown>(
    `/quiz/${quizId}/submit`,
    { answers, startedAt: startedAt ?? new Date().toISOString() },
    userToken,
  );
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select';
  required?: boolean;
  options?: string[];
}

/** Set an enrollment form on a quiz. */
export async function setEnrollmentForm(
  adminToken: string,
  quizId: string,
  fields: FormField[],
): Promise<void> {
  await apiPost<unknown>(`/quiz/${quizId}/enrollment-form`, { fields }, adminToken);
}
