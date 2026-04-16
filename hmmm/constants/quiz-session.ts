import AsyncStorage from '@react-native-async-storage/async-storage';

type SessionState = {
  answers: Record<string, Record<string, string>>;
  results: Record<string, any>;
  /** quizId → { questionIndex → questionId } */
  visitedQuestions: Record<string, Record<number, string>>;
  /** quizId → ISO string when the first question was loaded */
  examStartedAt: Record<string, string>;
  /** quizId → { questionIndex → epoch ms when that question timer was first started } */
  questionTimerStartedAt: Record<string, Record<number, number>>;
};

const session: SessionState = {
  answers: {},
  results: {},
  visitedQuestions: {},
  examStartedAt: {},
  questionTimerStartedAt: {},
};

const RESULTS_STORAGE_KEY = 'pi_quiz_results';

export const setAnswer = (quizId: string, questionId: string, optionId: string) => {
  if (!session.answers[quizId]) {
    session.answers[quizId] = {};
  }
  session.answers[quizId][questionId] = optionId;
};

export const getAnswer = (quizId: string, questionId: string) =>
  session.answers[quizId]?.[questionId] ?? "";

export const getQuizAnswers = (quizId: string) => session.answers[quizId] ?? {};

export const clearQuizAnswers = (quizId: string) => {
  delete session.answers[quizId];
};

/** Record that a question at a given index was visited (stores index → questionId). */
export const setVisitedQuestion = (quizId: string, index: number, questionId: string) => {
  if (!session.visitedQuestions[quizId]) {
    session.visitedQuestions[quizId] = {};
  }
  session.visitedQuestions[quizId][index] = questionId;
};

/** Returns the index→questionId map for a quiz. */
export const getVisitedQuestions = (quizId: string): Record<number, string> =>
  session.visitedQuestions[quizId] ?? {};

/** Record when the exam started (only sets once per quiz). */
export const setExamStartedAt = (quizId: string) => {
  if (!session.examStartedAt[quizId]) {
    session.examStartedAt[quizId] = new Date().toISOString();
  }
};

/** Returns the ISO start time for the exam, or null if not started. */
export const getExamStartedAt = (quizId: string): string | null =>
  session.examStartedAt[quizId] ?? null;

/**
 * Record that the timer for a specific question has started.
 * Only records the first call — subsequent calls for the same question are no-ops
 * so the timer is not reset if the user navigates away and returns.
 */
export const markQuestionStarted = (quizId: string, questionIndex: number): void => {
  if (!session.questionTimerStartedAt[quizId]) {
    session.questionTimerStartedAt[quizId] = {};
  }
  if (!session.questionTimerStartedAt[quizId][questionIndex]) {
    session.questionTimerStartedAt[quizId][questionIndex] = Date.now();
  }
};

/**
 * Returns how many seconds remain for a given question's per-question timer.
 * Uses the stored start time so the countdown is preserved across navigation.
 */
export const getQuestionRemainingTime = (
  quizId: string,
  questionIndex: number,
  timerSeconds: number,
): number => {
  const startedAt = session.questionTimerStartedAt[quizId]?.[questionIndex];
  if (!startedAt) return timerSeconds;
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, timerSeconds - elapsed);
};

export const setQuizResult = (quizId: string, result: any) => {
  session.results[quizId] = result;
  // Persist to AsyncStorage (and localStorage on web) so results survive a refresh
  try {
    const updated = { ...session.results };
    AsyncStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore storage errors
  }
};

export const getQuizResult = (quizId: string) => session.results[quizId] ?? null;

/** Call once at app startup to rehydrate persisted results. */
export async function loadPersistedResults(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RESULTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(session.results, parsed);
      return;
    }
  } catch {
    // ignore
  }
  // Web fallback
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(RESULTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(session.results, parsed);
      }
    }
  } catch {
    // ignore
  }
}
