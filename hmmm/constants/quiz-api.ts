import { apiUrl } from "@/constants/api";

export type QuizListItem = {
  id: string;
  title: string;
  category: string;
  startsAtIso: string;
  durationMinutes: number;
  level: "Beginner" | "Intermediate" | "Expert";
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
  seats: { status: string; available: number };
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

const json = async <T>(resPromise: Promise<Response>): Promise<T> => {
  const res = await resPromise;
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Request failed");
  }

  return (await res.json()) as T;
};

export const fetchQuizHome = () => json<any>(fetch(apiUrl("/quiz/home")));

export const fetchUpcomingQuizzes = () => json<QuizListItem[]>(fetch(apiUrl("/quiz/upcoming")));

export const fetchQuizDetail = (quizId: string) =>
  json<QuizDetail>(fetch(apiUrl(`/quiz/${quizId}`)));

export const fetchQuizLobby = (quizId: string) =>
  json<any>(fetch(apiUrl(`/quiz/${quizId}/lobby`)));

export const fetchQuizQuestion = (quizId: string, index: number) =>
  json<QuizQuestionPayload>(fetch(apiUrl(`/quiz/${quizId}/question/${index}`)));

export const submitQuizAnswers = (quizId: string, answers: Record<string, string>) =>
  json<QuizSubmitPayload>(
    fetch(apiUrl(`/quiz/${quizId}/submit`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }),
  );

export const fetchQuizLeaderboard = (quizId: string) =>
  json<{ rank: number; user: string; score: number; currentUser?: boolean }[]>(
    fetch(apiUrl(`/quiz/${quizId}/leaderboard`)),
  );

export const fetchReportsOverview = () => json<any>(fetch(apiUrl("/quiz/reports/overview")));
