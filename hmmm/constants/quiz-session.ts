import AsyncStorage from '@react-native-async-storage/async-storage';

type SessionState = {
  answers: Record<string, Record<string, string>>;
  results: Record<string, any>;
};

const session: SessionState = {
  answers: {},
  results: {},
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
