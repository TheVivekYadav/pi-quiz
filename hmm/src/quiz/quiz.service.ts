import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

type QuizQuestion = {
  id: string;
  text: string;
  imageUrl?: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  points: number;
};

type QuizDefinition = {
  id: string;
  title: string;
  topic: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Expert';
  durationMinutes: number;
  startsAtIso: string;
  description: string;
  expectations: string[];
  curatorNote: string;
  questions: QuizQuestion[];
};

@Injectable()
export class QuizService {
  private readonly quizzes: QuizDefinition[] = [
    {
      id: 'renaissance-masters',
      title: 'General Knowledge Masters',
      topic: 'Modern History',
      category: 'Universal Trivia',
      level: 'Expert',
      durationMinutes: 45,
      startsAtIso: '2026-10-24T18:00:00.000Z',
      description:
        "Join an elite circle of curious minds in the most comprehensive general knowledge challenge.",
      expectations: [
        '50 dynamic questions',
        'Real-time global leaderboard',
        'Exclusive digital certificate',
      ],
      curatorNote:
        'Designed for those who find wonder in the mundane and beauty in the complex.',
      questions: [
        {
          id: 'q1',
          text: 'Which artist is credited with painting the ceiling of the Sistine Chapel?',
          imageUrl:
            'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=1200&auto=format&fit=crop',
          options: [
            { id: 'a', label: 'Michelangelo Buonarroti' },
            { id: 'b', label: 'Leonardo da Vinci' },
            { id: 'c', label: 'Raphael Sanzio' },
            { id: 'd', label: 'Donatello' },
          ],
          correctOptionId: 'a',
          points: 10,
        },
        {
          id: 'q2',
          text: 'What year did the Berlin Wall fall?',
          options: [
            { id: 'a', label: '1987' },
            { id: 'b', label: '1989' },
            { id: 'c', label: '1991' },
            { id: 'd', label: '1993' },
          ],
          correctOptionId: 'b',
          points: 10,
        },
      ],
    },
    {
      id: 'quantum-basics',
      title: 'Quantum Physics Basics',
      topic: 'Quantum Mechanics',
      category: 'Science',
      level: 'Intermediate',
      durationMinutes: 25,
      startsAtIso: '2026-05-12T15:30:00.000Z',
      description: 'Test your understanding of foundational quantum concepts.',
      expectations: ['20 conceptual questions', 'Peer ranking', 'Completion badge'],
      curatorNote: 'Fast-paced and concept driven.',
      questions: [
        {
          id: 'q1',
          text: 'Who introduced the uncertainty principle?',
          options: [
            { id: 'a', label: 'Erwin Schrödinger' },
            { id: 'b', label: 'Werner Heisenberg' },
            { id: 'c', label: 'Niels Bohr' },
            { id: 'd', label: 'Max Planck' },
          ],
          correctOptionId: 'b',
          points: 10,
        },
      ],
    },
  ];

  getHome() {
    return {
      greeting: {
        title: 'Hello, Alex! Ready for a challenge?',
        subtitle:
          "Your intellectual journey continues today. You've conquered 12 topics this week.",
      },
      continueLearning: this.quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        category: q.category,
        progress: q.id === 'quantum-basics' ? 65 : 35,
      })),
      categories: [
        { id: 'modern-history', title: 'Modern History', icon: 'library-outline' },
        { id: 'quantum', title: 'Quantum Physics', icon: 'flask-outline' },
        { id: 'literature', title: 'Literature', icon: 'book-outline' },
        { id: 'fine-arts', title: 'Fine Arts', icon: 'color-palette-outline' },
      ],
      featured: this.quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        level: q.level,
        durationMinutes: q.durationMinutes,
        description: q.description,
      })),
    };
  }

  getReportsOverview() {
    return {
      date: new Date().toISOString(),
      totalEnrolled: 12800,
      activeNow: 142,
      completed: 3400,
      completionRate: 88,
      upcoming: [
        { id: 'quantum-basics', title: 'Quantum Physics Basics', category: 'Science' },
        { id: 'renaissance-masters', title: 'General Knowledge Masters', category: 'History' },
      ],
      insights: [
        "'Quantum Physics' enrollment is 40% higher than average.",
        "150 users completed the 'Ethics in AI' certificate today.",
      ],
    };
  }

  listUpcoming() {
    return this.quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      category: q.category,
      startsAtIso: q.startsAtIso,
      durationMinutes: q.durationMinutes,
      level: q.level,
    }));
  }

  getQuizDetail(quizId: string) {
    const quiz = this.findQuiz(quizId);

    return {
      id: quiz.id,
      title: quiz.title,
      topic: quiz.topic,
      category: quiz.category,
      durationMinutes: quiz.durationMinutes,
      startsAtIso: quiz.startsAtIso,
      description: quiz.description,
      expectations: quiz.expectations,
      curatorNote: quiz.curatorNote,
      seats: {
        status: 'Open Now',
        available: 42,
      },
    };
  }

  getLobby(quizId: string) {
    const quiz = this.findQuiz(quizId);
    const startsAtMs = new Date(quiz.startsAtIso).getTime();
    const now = Date.now();
    const seconds = Math.max(0, Math.floor((startsAtMs - now) / 1000));

    return {
      quizId: quiz.id,
      quizTitle: quiz.title,
      startsInSeconds: seconds,
      rules: [
        'Each question has a 20-second timer.',
        'Faster correct answers earn bonus velocity points.',
        'Leaving the quiz app during active question may disqualify the attempt.',
      ],
      lobby: {
        waitingCount: 124,
        sampleUsers: ['Sarah Jenkins', 'Marcus V.', 'Elena Rodriguez'],
      },
    };
  }

  getQuestion(quizId: string, index: number) {
    const quiz = this.findQuiz(quizId);

    if (!Number.isInteger(index) || index < 1 || index > quiz.questions.length) {
      throw new NotFoundException('Question not found');
    }

    const question = quiz.questions[index - 1];
    return {
      quizId: quiz.id,
      quizTitle: quiz.title,
      current: index,
      total: quiz.questions.length,
      timerSeconds: 45,
      highPoints: question.points > 8,
      question: {
        id: question.id,
        text: question.text,
        imageUrl: question.imageUrl,
        options: question.options,
      },
    };
  }

  submitQuiz(quizId: string, body: any) {
    const quiz = this.findQuiz(quizId);
    const answers = body?.answers;

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new BadRequestException('answers must be an object keyed by question id');
    }

    let correct = 0;

    for (const q of quiz.questions) {
      if (String(answers[q.id] ?? '') === q.correctOptionId) {
        correct += 1;
      }
    }

    const total = quiz.questions.length;
    const incorrect = total - correct;
    const accuracyRate = total === 0 ? 0 : Math.round((correct / total) * 100);

    return {
      attemptId: `attempt-${Date.now()}`,
      quizId: quiz.id,
      score: correct,
      total,
      accuracyRate,
      breakdown: {
        correct,
        incorrect,
        timeTakenMinutes: 12,
      },
      badge: accuracyRate >= 80 ? 'Quantum Scholar' : 'Curious Challenger',
      percentile: accuracyRate >= 80 ? 95 : 68,
      leaderboard: this.getLeaderboard(quiz.id),
    };
  }

  getLeaderboard(quizId: string) {
    this.findQuiz(quizId);

    return [
      { rank: 1, user: 'Sarah Jenkins', score: 10 },
      { rank: 2, user: 'David Chen', score: 9 },
      { rank: 3, user: 'Alex Rivera', score: 8, currentUser: true },
      { rank: 4, user: 'Elena Rodriguez', score: 8 },
    ];
  }

  private findQuiz(quizId: string) {
    const quiz = this.quizzes.find((q) => q.id === quizId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return quiz;
  }
}
