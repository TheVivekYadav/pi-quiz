type SessionState = {
  answers: Record<string, Record<string, string>>;
  results: Record<string, any>;
};

const session: SessionState = {
  answers: {},
  results: {},
};

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
};

export const getQuizResult = (quizId: string) => session.results[quizId] ?? null;
