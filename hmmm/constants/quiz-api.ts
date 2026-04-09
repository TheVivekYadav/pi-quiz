import { apiUrl } from "@/constants/api";
import { getAuthToken } from "@/constants/auth-session";

export type QuizListItem = {
  id: string;
  title: string;
  category: string;
  startsAtIso: string;
  durationMinutes: number;
  level: "Beginner" | "Intermediate" | "Expert";
};

export type EnrollmentFormField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "number" | "select";
  required: boolean;
  options?: string[];
};

export type EnrollmentForm = {
  formId: string;
  fields: EnrollmentFormField[];
};

export type QuizDetail = {
  id: string;
  title: string;
  topic: string;
  category: string;
  durationMinutes: number;
  startsAtIso: string;
  description: string;
  expectations: string[];
  curatorNote: string;
  imageUrl?: string;
  seats: { status: string; available: number };
  enrollmentForm: EnrollmentForm | null;
};

export type QuizQuestionPayload = {
  quizId: string;
  quizTitle: string;
  current: number;
  total: number;
  timerSeconds: number;
  highPoints: boolean;
  question: {
    id: string;
    text: string;
    imageUrl?: string;
    options: { id: string; label: string }[];
  };
};

export type QuizSubmitPayload = {
  attemptId: string;
  quizId: string;
  score: number;
  total: number;
  accuracyRate: number;
  breakdown: {
    correct: number;
    incorrect: number;
    timeTakenMinutes: number;
  };
  badge: string;
  percentile: number;
  leaderboard: { rank: number; user: string; score: number; currentUser?: boolean }[];
};

export type QuizHomePayload = {
  greeting?: string | { title?: string; subtitle?: string };
  continueLearning?: Array<{ id: string; title: string; category: string; progress?: number }>;
  categories?: Array<string | { id?: string; title?: string; icon?: string }>;
  featuredQuizzes?: QuizListItem[];
  featured?: QuizListItem[];
};

export type QuizReportsPayload = {
  metrics?: {
    totalEnrolled?: number | string;
    activeNow?: number | string;
    completed?: number | string;
    completionRate?: number | string;
  };
  upcomingQuizzes?: QuizListItem[];
  upcoming?: QuizListItem[];
  insights?: string[];
};

const getAuthHeaders = (includeJsonContentType = true) => {
  const token = getAuthToken();
  return {
    ...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

const json = async <T>(resPromise: Promise<Response>): Promise<T> => {
  const res = await resPromise;
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Request failed");
  }

  return (await res.json()) as T;
};

export const fetchQuizHome = () =>
  json<QuizHomePayload>(
    fetch(apiUrl("/quiz/home"), {
      headers: getAuthHeaders(),
    })
  );

export const fetchUpcomingQuizzes = () =>
  json<QuizListItem[]>(
    fetch(apiUrl("/quiz/upcoming"), {
      headers: getAuthHeaders(),
    })
  );

export const fetchQuizDetail = (quizId: string) =>
  json<QuizDetail>(fetch(apiUrl(`/quiz/${quizId}`), { headers: getAuthHeaders() }));

export const enrollQuiz = (quizId: string, formAnswers?: Record<string, string>) =>
  json<{ success: boolean; message: string }>(
    fetch(apiUrl(`/quiz/${quizId}/enroll`), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ formAnswers: formAnswers ?? {} }),
    })
  );

export const fetchQuizLobby = (quizId: string) =>
  json<any>(
    fetch(apiUrl(`/quiz/${quizId}/lobby`), {
      headers: getAuthHeaders(),
    })
  );

export const fetchQuizQuestion = (quizId: string, index: number) =>
  json<QuizQuestionPayload>(
    fetch(apiUrl(`/quiz/${quizId}/question/${index}`), {
      headers: getAuthHeaders(),
    })
  );

export const submitQuizAnswers = (quizId: string, answers: Record<string, string>, startedAt?: string) =>
  json<QuizSubmitPayload>(
    fetch(apiUrl(`/quiz/${quizId}/submit`), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ answers, startedAt }),
    })
  );

export const fetchQuizLeaderboard = (quizId: string) =>
  json<{ rank: number; user: string; score: number; currentUser?: boolean }[]>(
    fetch(apiUrl(`/quiz/${quizId}/leaderboard`), {
      headers: getAuthHeaders(),
    })
  );

export const fetchReportsOverview = () =>
  json<QuizReportsPayload>(
    fetch(apiUrl("/quiz/reports/overview"), {
      headers: getAuthHeaders(),
    })
  );

export const uploadQuizBannerImage = async (file: { uri: string; name?: string; type?: string }) => {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name ?? `banner-${Date.now()}.jpg`,
    type: file.type ?? 'image/jpeg',
  } as any);

  return json<{ success: boolean; url: string }>(
    fetch(apiUrl('/quiz/banner-upload'), {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: formData,
    })
  );
};

// ─── Admin API ──────────────────────────────────────────────────────────────

export type CreateQuizPayload = {
  title: string;
  topic: string;
  category: string;
  level: string;
  durationMinutes: number;
  startsAt: string;
  description?: string;
  expectations?: string;
  curatorNote?: string;
  imageUrl?: string;
};

export type AddQuestionPayload = {
  text: string;
  imageUrl?: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  points?: number;
};

export const adminListQuizzes = () =>
  json<QuizListItem[]>(
    fetch(apiUrl('/quiz/admin/list'), {
      headers: getAuthHeaders(),
    })
  );

export const adminCreateQuiz = (payload: CreateQuizPayload) =>
  json<QuizDetail>(
    fetch(apiUrl('/quiz'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
  );

export const adminAddQuestion = (quizId: string, payload: AddQuestionPayload) =>
  json<{ id: string; text: string }>(
    fetch(apiUrl(`/quiz/${quizId}/questions`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
  );

export const adminDeleteQuiz = (quizId: string) =>
  json<{ success: boolean }>(
    fetch(apiUrl(`/quiz/${quizId}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
  );

export const adminStartQuiz = (quizId: string) =>
  json<{ success: boolean }>(
    fetch(apiUrl(`/quiz/${quizId}/start`), {
      method: 'POST',
      headers: getAuthHeaders(),
    })
  );

export const adminSetEnrollmentForm = (quizId: string, fields: EnrollmentFormField[]) =>
  json<{ formId: string; fields: EnrollmentFormField[] }>(
    fetch(apiUrl(`/quiz/${quizId}/enrollment-form`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fields }),
    })
  );

export const adminDeclareWinners = (quizId: string) =>
  json<{ success: boolean; quizTitle: string; winners: { rank: number; user: string; rollNumber: string; score: number }[] }>(
    fetch(apiUrl(`/quiz/${quizId}/declare-winners`), {
      method: 'POST',
      headers: getAuthHeaders(),
    })
  );

export const fetchQuizWinners = (quizId: string) =>
  json<{ declared: boolean; declaredAt?: string; quizTitle: string; winners: { rank: number; user: string; rollNumber: string; score: number }[] }>(
    fetch(apiUrl(`/quiz/${quizId}/winners`), {
      headers: getAuthHeaders(),
    })
  );

export const adminFetchQuizReport = (quizId: string) =>
  json<any>(
    fetch(apiUrl(`/quiz/${quizId}/report`), {
      headers: getAuthHeaders(),
    })
  );

export const adminListQuestions = (quizId: string) =>
  json<{ id: string; text: string; imageUrl?: string; options: { id: string; label: string }[]; correctOptionId: string; points: number; questionIndex: number }[]>(
    fetch(apiUrl(`/quiz/${quizId}/questions`), {
      headers: getAuthHeaders(),
    })
  );

export const adminDeleteQuestion = (quizId: string, questionId: string) =>
  json<{ success: boolean }>(
    fetch(apiUrl(`/quiz/${quizId}/questions/${questionId}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
  );

export const adminFetchQuizResponses = (quizId: string) =>
  json<{
    questions: { id: string; text: string; options: { id: string; label: string }[]; correctOptionId: string; questionIndex: number }[];
    users: { userId: number; name: string; rollNumber: string; answers: Record<string, string> }[];
  }>(
    fetch(apiUrl(`/quiz/${quizId}/admin-responses`), {
      headers: getAuthHeaders(),
    })
  );

export const fetchMyQuizResponses = (quizId: string) =>
  json<{
    id: string;
    text: string;
    options: { id: string; label: string }[];
    correctOptionId: string;
    questionIndex: number;
    selectedOptionId: string | null;
    isCorrect: boolean;
  }[]>(
    fetch(apiUrl(`/quiz/${quizId}/my-responses`), {
      headers: getAuthHeaders(),
    })
  );
