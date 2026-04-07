import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service.js';

export interface QuizQuestion {
  id: string;
  text: string;
  imageUrl?: string;
  options: { id: string; label: string }[];
  points: number;
}

export interface QuizDetail {
  id: string;
  title: string;
  topic: string;
  category: string;
  level: string;
  durationMinutes: number;
  startsAtIso: string;
  description?: string;
  expectations?: string;
  curatorNote?: string;
}

export interface QuizListItem {
  id: string;
  title: string;
  category: string;
  startsAtIso: string;
  durationMinutes: number;
  level: string;
}

export interface QuizQuestionPayload {
  question: QuizQuestion;
  current: number;
  total: number;
  timerSeconds: number;
  highPoints: boolean;
}

export interface QuizSubmitPayload {
  attemptId: string;
  score: number;
  total: number;
  accuracyRate: number;
  breakdown: {
    correct: number;
    incorrect: number;
    timeTaken: string;
  };
  badge: string;
  percentile: number;
}

@Injectable()
export class QuizService {
  constructor(private databaseService: DatabaseService) {}

  async getHome(userId: number) {
    const pool = this.databaseService.getPool();

    // Get enrolled quizzes for continuing learning
    const enrolledResult = await pool.query(
      `SELECT q.* FROM quizzes q
       JOIN quiz_enrollments qe ON q.id = qe.quiz_id
       WHERE qe.user_id = $1
       ORDER BY q.starts_at DESC
       LIMIT 5`,
      [userId],
    );

    // Get all quizzes as featured
    const featuredResult = await pool.query(
      `SELECT id, title, category, starts_at, duration_minutes, level FROM quizzes
       ORDER BY starts_at DESC
       LIMIT 6`,
    );

    // Get categories
    const categoriesResult = await pool.query(
      `SELECT DISTINCT category FROM quizzes ORDER BY category`,
    );

    return {
      greeting: `Welcome back!`,
      continueLearning: enrolledResult.rows.map((q: any) => ({
        id: q.id,
        title: q.title,
        category: q.category,
        progress: Math.floor(Math.random() * 100),
      })),
      categories: categoriesResult.rows.map((r: any) => r.category),
      featuredQuizzes: featuredResult.rows.map((q: any) => ({
        id: q.id,
        title: q.title,
        category: q.category,
        startsAtIso: q.starts_at,
        durationMinutes: q.duration_minutes,
        level: q.level,
      })),
    };
  }

  async getReportsOverview(userId: number) {
    const pool = this.databaseService.getPool();

    // Get user's statistics
    const attemptsResult = await pool.query(
      `SELECT COUNT(*) as total, SUM(score) as totalScore FROM quiz_attempts WHERE user_id = $1`,
      [userId],
    );

    const enrolledResult = await pool.query(
      `SELECT COUNT(*) as count FROM quiz_enrollments WHERE user_id = $1`,
      [userId],
    );

    const attempts = attemptsResult.rows[0];
    const enrolled = enrolledResult.rows[0];

    return {
      metrics: {
        totalEnrolled: enrolled.count,
        activeNow: Math.floor(Math.random() * 50),
        completed: attempts.total,
        completionRate: attempts.total > 0 ? 88 : 0,
      },
      upcomingQuizzes: await this.listUpcoming(userId),
      insights: [
        'You are doing 23% better than last month',
        'Science quizzes are your strongest category',
        'Complete one more quiz to unlock Expert badge',
      ],
    };
  }

  async listUpcoming(userId: number): Promise<QuizListItem[]> {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT id, title, category, starts_at, duration_minutes, level FROM quizzes
       ORDER BY starts_at DESC
       LIMIT 10`,
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      startsAtIso: row.starts_at,
      durationMinutes: row.duration_minutes,
      level: row.level,
    }));
  }

  async getQuizDetail(quizId: string): Promise<QuizDetail> {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT * FROM quizzes WHERE id = $1`,
      [quizId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    const quiz = result.rows[0];
    return {
      id: quiz.id,
      title: quiz.title,
      topic: quiz.topic,
      category: quiz.category,
      level: quiz.level,
      durationMinutes: quiz.duration_minutes,
      startsAtIso: quiz.starts_at,
      description: quiz.description,
      expectations: quiz.expectations,
      curatorNote: quiz.curator_note,
    };
  }

  async getLobby(quizId: string, userId: number) {
    const pool = this.databaseService.getPool();

    // Check if user is enrolled
    const enrollmentResult = await pool.query(
      `SELECT * FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );

    if (!enrollmentResult.rows[0]) {
      throw new BadRequestException('User not enrolled in this quiz');
    }

    const quizResult = await pool.query(
      `SELECT starts_at FROM quizzes WHERE id = $1`,
      [quizId],
    );

    if (!quizResult.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    const startsAt = new Date(quizResult.rows[0].starts_at).getTime();
    const now = Date.now();
    const startsInSeconds = Math.max(0, Math.floor((startsAt - now) / 1000));

    // Get sample waiting users
    const usersResult = await pool.query(
      `SELECT DISTINCT u.name, u.roll_number FROM quiz_enrollments qe
       JOIN users u ON qe.user_id = u.id
       WHERE qe.quiz_id = $1
       LIMIT 10`,
      [quizId],
    );

    return {
      startsInSeconds,
      rules: [
        'Read each question carefully',
        'You have limited time per question',
        'Once submitted, answers cannot be changed',
        'Internet disconnection will pause your quiz',
      ],
      lobby: {
        waitingCount: Math.max(5, usersResult.rows.length),
        sampleUsers: (usersResult.rows || []).map((u: any, i: number) => ({
          name: u.name || `User ${i + 1}`,
          status: i === 0 ? 'ready' : 'waiting',
        })),
      },
    };
  }

  async getQuestion(
    quizId: string,
    userId: number,
    questionIndex: number,
  ): Promise<QuizQuestionPayload> {
    const pool = this.databaseService.getPool();

    // Get total questions
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM quiz_questions WHERE quiz_id = $1`,
      [quizId],
    );

    const total = parseInt(countResult.rows[0].total);

    // Get question by index
    const questionResult = await pool.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 AND question_index = $2`,
      [quizId, questionIndex],
    );

    if (!questionResult.rows[0]) {
      throw new NotFoundException('Question not found');
    }

    const q = questionResult.rows[0];
    const options = q.options || [];

    return {
      question: {
        id: q.id,
        text: q.question_text,
        imageUrl: q.image_url,
        options: options,
        points: q.points,
      },
      current: questionIndex,
      total,
      timerSeconds: 30,
      highPoints: q.points > 5,
    };
  }

  async submitQuiz(
    quizId: string,
    userId: number,
    answers: Record<string, string>,
  ): Promise<QuizSubmitPayload> {
    const pool = this.databaseService.getPool();

    // Get all questions for the quiz
    const questionsResult = await pool.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_index ASC`,
      [quizId],
    );

    const questions = questionsResult.rows;
    let score = 0;
    let correct = 0;
    let incorrect = 0;

    // Calculate score
    for (const question of questions) {
      const userAnswer = answers[question.id];
      if (userAnswer === question.correct_option_id) {
        score += question.points;
        correct++;
      } else {
        incorrect++;
      }
    }

    const total = questions.reduce((sum: number, q: any) => sum + q.points, 0);
    const accuracyRate = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    const attemptId = randomUUID();

    // Save attempt
    await pool.query(
      `INSERT INTO quiz_attempts (id, user_id, quiz_id, score, total, accuracy_rate)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [attemptId, userId, quizId, score, total, accuracyRate],
    );

    // Save individual responses
    for (const question of questions) {
      const selectedOptionId = answers[question.id] || null;
      if (selectedOptionId) {
        await pool.query(
          `INSERT INTO quiz_responses (id, attempt_id, question_id, selected_option_id)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), attemptId, question.id, selectedOptionId],
        );
      }
    }

    // Determine badge
    let badge = 'Participant';
    if (accuracyRate >= 90) badge = 'Expert';
    else if (accuracyRate >= 80) badge = 'Advanced';
    else if (accuracyRate >= 70) badge = 'Proficient';

    // Calculate percentile (mock data for now)
    const allAttemptsResult = await pool.query(
      `SELECT score FROM quiz_attempts WHERE quiz_id = $1 ORDER BY score DESC`,
      [quizId],
    );
    const allScores = allAttemptsResult.rows.map((r: any) => r.score);
    const percentile = allScores.filter((s: number) => s > score).length;

    return {
      attemptId,
      score,
      total,
      accuracyRate: Math.round(accuracyRate),
      breakdown: {
        correct,
        incorrect,
        timeTaken: '12m 34s',
      },
      badge,
      percentile: Math.max(1, 100 - percentile),
    };
  }

  async getLeaderboard(quizId: string, userId: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT u.name, u.roll_number, MAX(qa.score) as score, 
              ROW_NUMBER() OVER (ORDER BY MAX(qa.score) DESC) as rank
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.id
       WHERE qa.quiz_id = $1
       GROUP BY u.id, u.name, u.roll_number
       ORDER BY score DESC
       LIMIT 10`,
      [quizId],
    );

    return {
      leaderboard: result.rows.map((row: any, idx: number) => ({
        rank: idx + 1,
        name: row.name || `User ${idx + 1}`,
        rollNumber: row.roll_number,
        score: row.score || 0,
        isCurrentUser: row.user_id === userId,
      })),
    };
  }

  async enrollUser(userId: number, quizId: string) {
    const pool = this.databaseService.getPool();

    try {
      await pool.query(
        `INSERT INTO quiz_enrollments (user_id, quiz_id) VALUES ($1, $2)`,
        [userId, quizId],
      );
      return { success: true, message: 'Successfully enrolled' };
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        return { success: false, message: 'Already enrolled in this quiz' };
      }
      throw error;
    }
  }

  async canAccessQuiz(userId: number, quizId: string): Promise<boolean> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `SELECT * FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );
    return result.rows.length > 0;
  }
}
