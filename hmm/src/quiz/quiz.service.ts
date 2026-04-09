import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
  imageUrl?: string;
}

export interface QuizListItem {
  id: string;
  title: string;
  category: string;
  startsAtIso: string;
  durationMinutes: number;
  level: string;
  enrolledCount?: number;
  isVisible?: boolean;
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
    timeTakenMinutes: number;
  };
  badge: string;
  percentile: number;
}

@Injectable()
export class QuizService {
  constructor(private databaseService: DatabaseService) {}

  async getHome(userId: number) {
    const pool = this.databaseService.getPool();

    // Get enrolled quizzes with real attempt-based progress
    const enrolledResult = await pool.query(
      `SELECT q.id, q.title, q.category,
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) AS total_questions,
              (SELECT COUNT(DISTINCT qr.question_id)
               FROM quiz_attempts qa
               JOIN quiz_responses qr ON qr.attempt_id = qa.id
               WHERE qa.user_id = $1 AND qa.quiz_id = q.id) AS answered_questions
       FROM quizzes q
       JOIN quiz_enrollments qe ON q.id = qe.quiz_id
       WHERE qe.user_id = $1
       ORDER BY q.starts_at DESC
       LIMIT 5`,
      [userId],
    );

    // Get upcoming (future) quizzes as featured
    const featuredResult = await pool.query(
      `SELECT id, title, category, starts_at, duration_minutes, level FROM quizzes
       WHERE starts_at >= NOW() AND is_visible = TRUE
       ORDER BY starts_at ASC
       LIMIT 6`,
    );

    // Get categories
    const categoriesResult = await pool.query(
      `SELECT DISTINCT category FROM quizzes WHERE is_visible = TRUE ORDER BY category`,
    );

    return {
      greeting: `Welcome back!`,
      continueLearning: enrolledResult.rows.map((q: any) => {
        const total = parseInt(q.total_questions) || 0;
        const answered = parseInt(q.answered_questions) || 0;
        const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
        return {
          id: q.id,
          title: q.title,
          category: q.category,
          progress,
        };
      }),
      categories: categoriesResult.rows.map((r: any) => r.category),
      featuredQuizzes: featuredResult.rows.map((q: any) => ({
        id: q.id,
        title: q.title,
        category: q.category,
        startsAtIso: new Date(q.starts_at).toISOString(),
        durationMinutes: q.duration_minutes,
        level: q.level,
      })),
    };
  }

  async getReportsOverview(
    userId: number,
    role: 'admin' | 'user' = 'user',
    range: 'today' | 'week' | 'month' | 'all' = 'all',
  ) {
    const pool = this.databaseService.getPool();

    // ─── Admin: platform-wide overview ──────────────────────────────────────
    if (role === 'admin') {
      const normalizedRange: 'today' | 'week' | 'month' | 'all' =
        range === 'today' || range === 'week' || range === 'month' || range === 'all'
          ? range
          : 'all';

      const currentWindowByRange: Record<'today' | 'week' | 'month' | 'all', string> = {
        today: "date_trunc('day', NOW())",
        week: "date_trunc('week', NOW())",
        month: "date_trunc('month', NOW())",
        all: "NOW() - INTERVAL '30 days'",
      };
      const previousWindowByRange: Record<'today' | 'week' | 'month' | 'all', string> = {
        today: "date_trunc('day', NOW()) - INTERVAL '1 day'",
        week: "date_trunc('week', NOW()) - INTERVAL '1 week'",
        month: "date_trunc('month', NOW()) - INTERVAL '1 month'",
        all: "NOW() - INTERVAL '60 days'",
      };

      const currentStart = currentWindowByRange[normalizedRange];
      const previousStart = previousWindowByRange[normalizedRange];
      const currentEnd = normalizedRange === 'all' ? 'NOW()' : null;

      const currentRangeExpr = (alias: string, column: string) =>
        currentEnd
          ? `${alias}.${column} >= ${currentStart} AND ${alias}.${column} < ${currentEnd}`
          : `${alias}.${column} >= ${currentStart}`;
      const previousRangeExpr = (alias: string, column: string) =>
        `${alias}.${column} >= ${previousStart} AND ${alias}.${column} < ${currentStart}`;

      const [usersTotals, quizzesRow, enrollTotals, attemptsTotals, distributionRow, perQuizResult] = await Promise.all([
        pool.query(
          `SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE ${currentRangeExpr('u', 'created_at')})::int AS current,
            COUNT(*) FILTER (WHERE ${previousRangeExpr('u', 'created_at')})::int AS previous
           FROM users u`,
        ),
        pool.query(`SELECT COUNT(*)::int as count FROM quizzes`),
        pool.query(
          `SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE ${currentRangeExpr('qe', 'enrolled_at')})::int AS current,
            COUNT(*) FILTER (WHERE ${previousRangeExpr('qe', 'enrolled_at')})::int AS previous
           FROM quiz_enrollments qe`,
        ),
        pool.query(
          `SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE ${currentRangeExpr('qa', 'submitted_at')})::int AS current,
            COUNT(*) FILTER (WHERE ${previousRangeExpr('qa', 'submitted_at')})::int AS previous,
            COALESCE(ROUND(AVG(qa.accuracy_rate) FILTER (WHERE ${currentRangeExpr('qa', 'submitted_at')})), 0)::int AS avg_accuracy_current,
            COALESCE(ROUND(AVG(qa.accuracy_rate) FILTER (WHERE ${previousRangeExpr('qa', 'submitted_at')})), 0)::int AS avg_accuracy_previous
           FROM quiz_attempts qa`,
        ),
        pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE qa.accuracy_rate < 40)::int AS under_40,
            COUNT(*) FILTER (WHERE qa.accuracy_rate >= 40 AND qa.accuracy_rate < 60)::int AS between_40_60,
            COUNT(*) FILTER (WHERE qa.accuracy_rate >= 60 AND qa.accuracy_rate < 80)::int AS between_60_80,
            COUNT(*) FILTER (WHERE qa.accuracy_rate >= 80)::int AS above_80
           FROM quiz_attempts qa
           WHERE ${currentRangeExpr('qa', 'submitted_at')}`,
        ),
        pool.query(
          `SELECT q.id, q.title, q.category, q.starts_at,
                  COUNT(DISTINCT qe.user_id) FILTER (WHERE ${currentRangeExpr('qe', 'enrolled_at')})::int AS enrolled,
                  COUNT(DISTINCT qa.id) FILTER (WHERE ${currentRangeExpr('qa', 'submitted_at')})::int AS attempts,
                  COALESCE(MAX(qa.score) FILTER (WHERE ${currentRangeExpr('qa', 'submitted_at')}),0)::int AS top_score,
                  q.winners_declared_at
           FROM quizzes q
           LEFT JOIN quiz_enrollments qe ON qe.quiz_id = q.id
           LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
           GROUP BY q.id
           ORDER BY attempts DESC, enrolled DESC, q.starts_at DESC
           LIMIT 20`,
        ),
      ]);

      const usersTotal = usersTotals.rows[0]?.total ?? 0;
      const usersCurrent = usersTotals.rows[0]?.current ?? 0;
      const usersPrevious = usersTotals.rows[0]?.previous ?? 0;

      const enrolledTotal = enrollTotals.rows[0]?.total ?? 0;
      const enrolledCurrent = enrollTotals.rows[0]?.current ?? 0;
      const enrolledPrevious = enrollTotals.rows[0]?.previous ?? 0;

      const attemptsTotal = attemptsTotals.rows[0]?.total ?? 0;
      const attemptsCurrent = attemptsTotals.rows[0]?.current ?? 0;
      const attemptsPrevious = attemptsTotals.rows[0]?.previous ?? 0;
      const avgAccuracyCurrent = attemptsTotals.rows[0]?.avg_accuracy_current ?? 0;
      const avgAccuracyPrevious = attemptsTotals.rows[0]?.avg_accuracy_previous ?? 0;

      const metricUsers = normalizedRange === 'all' ? usersTotal : usersCurrent;
      const metricEnrolled = normalizedRange === 'all' ? enrolledTotal : enrolledCurrent;
      const metricAttempts = normalizedRange === 'all' ? attemptsTotal : attemptsCurrent;

      const attemptsPerUser = metricUsers > 0 ? Number((metricAttempts / metricUsers).toFixed(1)) : 0;
      const enrollmentsPerUser = metricUsers > 0 ? Number((metricEnrolled / metricUsers).toFixed(1)) : 0;

      const zeroAttemptQuizzes = perQuizResult.rows.filter((r: any) => (parseInt(r.attempts) || 0) === 0).length;
      const mostActiveQuiz = perQuizResult.rows.find((r: any) => (parseInt(r.attempts) || 0) > 0);

      const insights: string[] = [];
      if (zeroAttemptQuizzes > 0) {
        insights.push(`⚠️ ${zeroAttemptQuizzes} quizzes have no attempts in this period.`);
      }
      if (mostActiveQuiz) {
        insights.push(`🔥 Most active quiz: ${mostActiveQuiz.title} (${parseInt(mostActiveQuiz.attempts) || 0} attempts).`);
      }
      if (avgAccuracyCurrent < avgAccuracyPrevious) {
        insights.push(`📉 Accuracy dropped by ${Math.abs(avgAccuracyCurrent - avgAccuracyPrevious)}% versus previous period.`);
      } else if (avgAccuracyCurrent > avgAccuracyPrevious) {
        insights.push(`📈 Accuracy improved by ${Math.abs(avgAccuracyCurrent - avgAccuracyPrevious)}% versus previous period.`);
      }

      return {
        admin: true,
        range: normalizedRange,
        metrics: {
          totalUsers: metricUsers,
          totalQuizzes: parseInt(quizzesRow.rows[0].count) || 0,
          totalEnrolled: metricEnrolled,
          totalAttempts: metricAttempts,
          avgAccuracy: avgAccuracyCurrent,
          attemptsPerUser,
          enrollmentsPerUser,
          trends: {
            totalUsers: usersCurrent - usersPrevious,
            totalEnrolled: enrolledCurrent - enrolledPrevious,
            totalAttempts: attemptsCurrent - attemptsPrevious,
            avgAccuracy: avgAccuracyCurrent - avgAccuracyPrevious,
          },
        },
        accuracyDistribution: {
          under40: distributionRow.rows[0]?.under_40 ?? 0,
          between40to60: distributionRow.rows[0]?.between_40_60 ?? 0,
          between60to80: distributionRow.rows[0]?.between_60_80 ?? 0,
          above80: distributionRow.rows[0]?.above_80 ?? 0,
        },
        insights,
        quizSummaries: perQuizResult.rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          startsAtIso: new Date(r.starts_at).toISOString(),
          enrolled: parseInt(r.enrolled) || 0,
          attempts: parseInt(r.attempts) || 0,
          topScore: parseInt(r.top_score) || 0,
          winnersDeclared: !!r.winners_declared_at,
        })),
      };
    }

    // ─── User: personal overview ─────────────────────────────────────────────

    // Get user's statistics
    const attemptsResult = await pool.query(
      `SELECT COUNT(*) as total, SUM(score) as totalScore FROM quiz_attempts WHERE user_id = $1`,
      [userId],
    );

    const enrolledResult = await pool.query(
      `SELECT COUNT(*) as count FROM quiz_enrollments WHERE user_id = $1`,
      [userId],
    );

    // Count currently active sessions across all users (platform-wide metric)
    const activeNowResult = await pool.query(
      `SELECT COUNT(*) as count FROM user_sessions
       WHERE revoked_at IS NULL AND is_blocked = FALSE
         AND last_seen_at >= NOW() - INTERVAL '15 minutes'`,
    );

    const attempts = attemptsResult.rows[0];
    const enrolled = enrolledResult.rows[0];
    const activeNow = parseInt(activeNowResult.rows[0].count) || 0;

    const totalAttempts = parseInt(attempts.total) || 0;
    const totalEnrolled = parseInt(enrolled.count) || 0;
    const completionRate =
      totalEnrolled > 0 ? Math.round((totalAttempts / totalEnrolled) * 100) : 0;

    // Build dynamic insights from real data
    const insights: string[] = [];
    if (totalAttempts === 0) {
      insights.push('Start your first quiz to see personalised insights here.');
    } else {
      const avgResult = await pool.query(
        `SELECT AVG(accuracy_rate) as avg_acc FROM quiz_attempts WHERE user_id = $1`,
        [userId],
      );
      const avg = Math.round(parseFloat(avgResult.rows[0].avg_acc) || 0);
      insights.push(`Your average accuracy across all attempts is ${avg}%.`);
      if (completionRate < 100) {
        insights.push(`You have completed ${completionRate}% of your enrolled quizzes.`);
      } else {
        insights.push('Great job — you have completed every quiz you enrolled in!');
      }
    }

    return {
      metrics: {
        totalEnrolled,
        activeNow,
        completed: totalAttempts,
        completionRate,
      },
      upcomingQuizzes: await this.listUpcoming(userId),
      insights,
    };
  }

  async listUpcoming(userId: number): Promise<QuizListItem[]> {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT id, title, category, starts_at, duration_minutes, level FROM quizzes
       WHERE starts_at >= NOW() AND is_visible = TRUE
       ORDER BY starts_at ASC
       LIMIT 10`,
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      startsAtIso: new Date(row.starts_at).toISOString(),
      durationMinutes: row.duration_minutes,
      level: row.level,
    }));
  }

  async getQuizDetail(quizId: string): Promise<QuizDetail & { enrollmentForm: { id: string; fields: any[] } | null }> {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT q.*, f.id as form_id, f.fields as form_fields
       FROM quizzes q
       LEFT JOIN forms f ON f.id = q.enrollment_form_id
       WHERE q.id = $1`,
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
      imageUrl: quiz.image_url,
      enrollmentForm: quiz.form_id
        ? { id: quiz.form_id, fields: quiz.form_fields ?? [] }
        : null,
    };
  }

  async getLobby(quizId: string, userId: number) {
    const pool = this.databaseService.getPool();

    // Check if user is enrolled
    const enrollmentResult = await pool.query(
      `SELECT id, attempts_count, locked_until, is_completed, completed_at
       FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );

    if (!enrollmentResult.rows[0]) {
      throw new BadRequestException('User not enrolled in this quiz');
    }

    const quizResult = await pool.query(
      `SELECT title, starts_at FROM quizzes WHERE id = $1`,
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

    // Count all enrolled users (real waiting count)
    const waitingCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM quiz_enrollments WHERE quiz_id = $1`,
      [quizId],
    );
    const waitingCount = parseInt(waitingCountResult.rows[0].count) || 0;

    const enrollmentRow = enrollmentResult.rows[0];
    const lockedUntilIso = enrollmentRow.locked_until ? new Date(enrollmentRow.locked_until).toISOString() : null;
    const lockedSeconds = enrollmentRow.locked_until ? Math.max(0, Math.ceil((new Date(enrollmentRow.locked_until).getTime() - Date.now()) / 1000)) : 0;

    return {
      quizTitle: quizResult.rows[0].title,
      startsInSeconds,
      rules: [
        'Read each question carefully',
        'You have limited time per question',
        'Once submitted, answers cannot be changed',
        'Internet disconnection will pause your quiz',
      ],
      lobby: {
        waitingCount,
        sampleUsers: (usersResult.rows || []).map((u: any, i: number) => ({
          name: u.name || u.roll_number || `User ${i + 1}`,
          status: 'ready',
        })),
      },
      enrollment: {
        attemptsCount: parseInt(enrollmentRow.attempts_count) || 0,
        lockedUntilIso,
        lockedSeconds,
        maxAttempts: 2,
        isCompleted: !!enrollmentRow.is_completed,
        completedAt: enrollmentRow.completed_at ? new Date(enrollmentRow.completed_at).toISOString() : null,
      },
    };
  }

  async getQuestion(
    quizId: string,
    userId: number,
    questionIndex: number,
  ): Promise<QuizQuestionPayload> {
    const pool = this.databaseService.getPool();
    // Ensure quiz has started
    const quizStartRes = await pool.query(`SELECT starts_at, duration_minutes FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizStartRes.rows[0]) throw new NotFoundException('Quiz not found');
    const startsAt = new Date(quizStartRes.rows[0].starts_at).getTime();
    const durationMinutes: number = parseInt(quizStartRes.rows[0].duration_minutes) || 30;
    const now = Date.now();
    if (now < startsAt) {
      throw new ForbiddenException('Quiz has not started yet');
    }
    // Block completed users from fetching questions
    const completedCheck = await pool.query(
      `SELECT is_completed FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );
    if (completedCheck.rows[0]?.is_completed) {
      throw new ForbiddenException('You have already completed this quiz');
    }
    // Get total questions
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM quiz_questions WHERE quiz_id = $1`,
      [quizId],
    );

    const total = parseInt(countResult.rows[0].total);

    // Compute per-question timer: distribute quiz duration evenly across questions (min 10s, max 120s)
    const totalSeconds = durationMinutes * 60;
    const timerSeconds = total > 0
      ? Math.min(120, Math.max(10, Math.floor(totalSeconds / total)))
      : 30;

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
      timerSeconds,
      highPoints: q.points > 5,
    };
  }

  async submitQuiz(
    quizId: string,
    userId: number,
    answers: Record<string, string>,
    startedAtIso?: string,
  ): Promise<QuizSubmitPayload> {
    const pool = this.databaseService.getPool();

    // Compute time taken from client-supplied startedAt (clamped 0–120 min)
    const submittedAt = Date.now();
    let timeTakenMinutes = 0;
    if (startedAtIso) {
      const startedAt = new Date(startedAtIso).getTime();
      if (!isNaN(startedAt) && startedAt < submittedAt) {
        timeTakenMinutes = Math.min(120, Math.round((submittedAt - startedAt) / 60_000));
      }
    }

    // Ensure quiz has started before accepting submissions
    const quizStartRes = await pool.query(`SELECT starts_at FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizStartRes.rows[0]) throw new NotFoundException('Quiz not found');
    const startsAt = new Date(quizStartRes.rows[0].starts_at).getTime();
    const now = Date.now();
    if (now < startsAt) {
      throw new ForbiddenException('Quiz has not started yet');
    }

    // Check enrollment attempt counts and lockout
    const enrolRes = await pool.query(
      `SELECT id, attempts_count, locked_until, is_completed FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );
    if (!enrolRes.rows[0]) {
      throw new BadRequestException('User not enrolled in this quiz');
    }

    const enrollment = enrolRes.rows[0];
    const MAX_ATTEMPTS = 2;
    const LOCK_MINUTES = 15;

    // Block permanently completed users
    if (enrollment.is_completed) {
      throw new ForbiddenException('You have already completed this quiz');
    }

    if (enrollment.locked_until) {
      const lockedUntil = new Date(enrollment.locked_until).getTime();
      if (Date.now() < lockedUntil) {
        const remainingMs = lockedUntil - Date.now();
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        throw new ForbiddenException(`Too many attempts. Locked for ${remainingSeconds} seconds.`);
      }
    }


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

    // Increment attempts_count for this enrollment
    await pool.query(
      `UPDATE quiz_enrollments SET attempts_count = COALESCE(attempts_count,0) + 1, locked_until = NULL WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );

    // If attempts reached limit, permanently mark as completed (and set a short lockout as belt-and-suspenders)
    const attemptsRow = await pool.query(
      `SELECT attempts_count FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );
    const attemptsCount = parseInt(attemptsRow.rows[0].attempts_count) || 0;
    if (attemptsCount >= MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE quiz_enrollments
         SET is_completed = TRUE, completed_at = NOW(),
             locked_until = NOW() + ($1 || ' minutes')::interval
         WHERE user_id = $2 AND quiz_id = $3`,
        [String(LOCK_MINUTES), userId, quizId],
      );
    }

    // Determine badge
    let badge = 'Participant';
    if (accuracyRate >= 90) badge = 'Expert';
    else if (accuracyRate >= 80) badge = 'Advanced';
    else if (accuracyRate >= 70) badge = 'Proficient';

    // Calculate real percentile from DB
    const allAttemptsResult = await pool.query(
      `SELECT score FROM quiz_attempts WHERE quiz_id = $1 ORDER BY score DESC`,
      [quizId],
    );
    const allScores = allAttemptsResult.rows.map((r: any) => r.score);
    const betterCount = allScores.filter((s: number) => s > score).length;
    const percentile =
      allScores.length > 1
        ? Math.round(((allScores.length - 1 - betterCount) / (allScores.length - 1)) * 100)
        : 100;

    return {
      attemptId,
      score,
      total,
      accuracyRate: Math.round(accuracyRate),
      breakdown: {
        correct,
        incorrect,
        timeTakenMinutes,
      },
      badge,
      percentile: Math.max(1, percentile),
    };
  }

  async getLeaderboard(quizId: string, userId: number) {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT u.id as user_id, u.name, u.roll_number, MAX(qa.score) as score,
              ROW_NUMBER() OVER (ORDER BY MAX(qa.score) DESC) as rank
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.id
       WHERE qa.quiz_id = $1
       GROUP BY u.id, u.name, u.roll_number
       ORDER BY score DESC
       LIMIT 10`,
      [quizId],
    );

    // Return a flat array matching frontend QuizListItem expectations
    return result.rows.map((row: any, idx: number) => ({
      rank: idx + 1,
      user: row.name || row.roll_number || `User ${idx + 1}`,
      rollNumber: row.roll_number,
      score: parseInt(row.score) || 0,
      currentUser: row.user_id === userId,
    }));
  }

  async enrollUser(userId: number, quizId: string, formAnswers?: Record<string, any>) {
    const pool = this.databaseService.getPool();

    const visibleCheck = await pool.query(
      `SELECT is_visible FROM quizzes WHERE id = $1`,
      [quizId],
    );
    if (!visibleCheck.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }
    if (!visibleCheck.rows[0].is_visible) {
      throw new ForbiddenException('This quiz is currently hidden by admin');
    }

    // Check if this quiz has an enrollment form
    const quizResult = await pool.query(
      `SELECT enrollment_form_id FROM quizzes WHERE id = $1`,
      [quizId],
    );
    const enrollmentFormId: string | null = quizResult.rows[0]?.enrollment_form_id ?? null;

    // If quiz has an enrollment form, form answers are required
    if (enrollmentFormId && (!formAnswers || Object.keys(formAnswers).length === 0)) {
      throw new BadRequestException('This quiz requires you to fill out the enrollment form.');
    }

    // Validate required fields if a form is attached
    if (enrollmentFormId) {
      const formResult = await pool.query(
        `SELECT fields FROM forms WHERE id = $1`,
        [enrollmentFormId],
      );
      const fields: any[] = formResult.rows[0]?.fields ?? [];
      for (const field of fields) {
        if (field.required && !formAnswers![field.id]) {
          throw new BadRequestException(`Field "${field.label}" is required.`);
        }
      }
    }

    try {
      // Check if user has already completed this quiz
      const existingEnroll = await pool.query(
        `SELECT is_completed FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
        [userId, quizId],
      );
      if (existingEnroll.rows[0]?.is_completed) {
        throw new BadRequestException('You have already completed this quiz and cannot re-enroll');
      }

      // Save form response first (if applicable)
      let formResponseId: string | null = null;
      if (enrollmentFormId && formAnswers) {
        formResponseId = randomUUID();
        await pool.query(
          `INSERT INTO responses (id, form_id, answers) VALUES ($1, $2, $3::jsonb)`,
          [formResponseId, enrollmentFormId, JSON.stringify(formAnswers)],
        );
      }

      await pool.query(
        `INSERT INTO quiz_enrollments (user_id, quiz_id, form_response_id) VALUES ($1, $2, $3)`,
        [userId, quizId, formResponseId],
      );
      return { success: true, message: 'Successfully enrolled' };
    } catch (error: any) {
      if (error.code === '23505') {
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

  // ─── Admin methods ───────────────────────────────────────────────────────

  async createQuiz(createdByUserId: number, body: {
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
  }): Promise<QuizDetail> {
    const pool = this.databaseService.getPool();
    const id = randomUUID();

    await pool.query(
      `INSERT INTO quizzes
         (id, title, topic, category, level, duration_minutes, starts_at, description, expectations, curator_note, image_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        body.title,
        body.topic,
        body.category,
        body.level,
        body.durationMinutes,
        new Date(body.startsAt).toISOString(),
        body.description ?? null,
        body.expectations ?? null,
        body.curatorNote ?? null,
        body.imageUrl ?? null,
        createdByUserId,
      ],
    );

    return {
      id,
      title: body.title,
      topic: body.topic,
      category: body.category,
      level: body.level,
      durationMinutes: body.durationMinutes,
      startsAtIso: body.startsAt,
      description: body.description,
      expectations: body.expectations,
      curatorNote: body.curatorNote,
      imageUrl: body.imageUrl,
    };
  }

  async addQuestion(quizId: string, body: {
    text: string;
    imageUrl?: string;
    options: { id: string; label: string }[];
    correctOptionId: string;
    points?: number;
  }): Promise<QuizQuestion> {
    const pool = this.databaseService.getPool();

    // Ensure quiz exists
    const quizCheck = await pool.query(`SELECT id FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizCheck.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    // Get next question index
    const indexResult = await pool.query(
      `SELECT COALESCE(MAX(question_index), 0) + 1 AS next_index FROM quiz_questions WHERE quiz_id = $1`,
      [quizId],
    );
    const questionIndex = parseInt(indexResult.rows[0].next_index);

    const id = randomUUID();
    const points = body.points ?? 1;

    await pool.query(
      `INSERT INTO quiz_questions
         (id, quiz_id, question_text, image_url, options, correct_option_id, points, question_index)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        id,
        quizId,
        body.text,
        body.imageUrl ?? null,
        JSON.stringify(body.options),
        body.correctOptionId,
        points,
        questionIndex,
      ],
    );

    return {
      id,
      text: body.text,
      imageUrl: body.imageUrl,
      options: body.options,
      points,
    };
  }

  async deleteQuiz(quizId: string): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `DELETE FROM quizzes WHERE id = $1 RETURNING id`,
      [quizId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }
    return { success: true };
  }

  /** Admin: list all questions for a quiz. */
  async getQuizQuestions(quizId: string) {
    const pool = this.databaseService.getPool();
    const quizCheck = await pool.query(`SELECT id FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizCheck.rows[0]) throw new NotFoundException('Quiz not found');

    const result = await pool.query(
      `SELECT id, question_text, image_url, options, correct_option_id, points, question_index
       FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_index ASC`,
      [quizId],
    );
    return result.rows.map((q: any) => ({
      id: q.id,
      text: q.question_text,
      imageUrl: q.image_url,
      options: q.options,
      correctOptionId: q.correct_option_id,
      points: q.points,
      questionIndex: q.question_index,
    }));
  }

  /** Admin: delete a single question. */
  async deleteQuestion(quizId: string, questionId: string): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `DELETE FROM quiz_questions WHERE id = $1 AND quiz_id = $2 RETURNING id`,
      [questionId, quizId],
    );
    if (!result.rows[0]) throw new NotFoundException('Question not found');
    return { success: true };
  }

  /** Admin: get all users' answers for every question in a quiz. */
  async adminGetQuizResponses(quizId: string) {
    const pool = this.databaseService.getPool();

    const questionsResult = await pool.query(
      `SELECT id, question_text, options, correct_option_id, question_index
       FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_index ASC`,
      [quizId],
    );

    // Latest attempt per user's response per question
    const responsesResult = await pool.query(
      `SELECT DISTINCT ON (u.id, qr.question_id)
              u.id AS user_id, u.name, u.roll_number,
              qr.question_id, qr.selected_option_id
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.id
       JOIN quiz_responses qr ON qr.attempt_id = qa.id
       WHERE qa.quiz_id = $1
       ORDER BY u.id, qr.question_id, qa.submitted_at DESC`,
      [quizId],
    );

    const userMap = new Map<number, { userId: number; name: string; rollNumber: string; answers: Record<string, string> }>();
    for (const row of responsesResult.rows) {
      if (!userMap.has(row.user_id)) {
        userMap.set(row.user_id, { userId: row.user_id, name: row.name, rollNumber: row.roll_number, answers: {} });
      }
      userMap.get(row.user_id)!.answers[row.question_id] = row.selected_option_id;
    }

    return {
      questions: questionsResult.rows.map((q: any) => ({
        id: q.id,
        text: q.question_text,
        options: q.options,
        correctOptionId: q.correct_option_id,
        questionIndex: q.question_index,
      })),
      users: Array.from(userMap.values()),
    };
  }

  /** Admin: get all enrollments for a quiz with enrollment form responses. */
  async getQuizEnrollments(quizId: string) {
    const pool = this.databaseService.getPool();

    // Ensure quiz exists
    const quizCheck = await pool.query(`SELECT id, enrollment_form_id FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizCheck.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    const formId = quizCheck.rows[0].enrollment_form_id;

    // Get all enrolled users
    const enrollmentsResult = await pool.query(
      `SELECT qe.user_id, qe.enrolled_at, qe.form_response_id, u.id, u.name, u.roll_number
       FROM quiz_enrollments qe
       JOIN users u ON qe.user_id = u.id
       WHERE qe.quiz_id = $1
       ORDER BY qe.enrolled_at DESC`,
      [quizId],
    );

    // Get enrollment form fields
    let formFields: any[] = [];
    if (formId) {
      const formResult = await pool.query(
        `SELECT fields FROM forms WHERE id = $1`,
        [formId],
      );
      if (formResult.rows[0]) {
        formFields = formResult.rows[0].fields || [];
      }
    }

    // Build enrollments with form data
    const enrollments = enrollmentsResult.rows.map((row: any) => ({
      userId: row.user_id,
      name: row.name,
      rollNumber: row.roll_number,
      enrolledAt: new Date(row.enrolled_at).toISOString(),
      formResponseId: row.form_response_id ?? null,
      formResponses: {},
    }));

    if (enrollments.length > 0) {
      const responseIds = enrollments
        .map((row: any) => row.formResponseId)
        .filter((responseId: string | null) => !!responseId);

      if (responseIds.length > 0) {
        const responsesResult = await pool.query(
          `SELECT id, answers
           FROM responses
           WHERE id = ANY($1::text[])`,
          [responseIds],
        );

        const responseMap = new Map<string, any>();
        responsesResult.rows.forEach((response: any) => {
          responseMap.set(response.id, response.answers || {});
        });

        for (const enrollment of enrollments) {
          enrollment.formResponses = enrollment.formResponseId
            ? responseMap.get(enrollment.formResponseId) || {}
            : {};
        }
      }
    }

    return {
      totalEnrolled: enrollments.length,
      formId: formId || null,
      formFields: formFields,
      enrollments: enrollments,
    };
  }

  /** User: get their own answers for a quiz (most recent attempt). */
  async getUserQuizResponses(quizId: string, userId: number) {
    const pool = this.databaseService.getPool();

    const attemptResult = await pool.query(
      `SELECT id FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 ORDER BY submitted_at DESC LIMIT 1`,
      [quizId, userId],
    );
    if (!attemptResult.rows[0]) throw new NotFoundException('No attempt found for this quiz');
    const attemptId = attemptResult.rows[0].id;

    const result = await pool.query(
      `SELECT qq.id, qq.question_text, qq.options, qq.correct_option_id, qq.question_index,
              qr.selected_option_id
       FROM quiz_questions qq
       LEFT JOIN quiz_responses qr ON qr.question_id = qq.id AND qr.attempt_id = $1
       WHERE qq.quiz_id = $2
       ORDER BY qq.question_index ASC`,
      [attemptId, quizId],
    );

    return result.rows.map((q: any) => ({
      id: q.id,
      text: q.question_text,
      options: q.options,
      correctOptionId: q.correct_option_id,
      questionIndex: q.question_index,
      selectedOptionId: q.selected_option_id ?? null,
      isCorrect: q.selected_option_id === q.correct_option_id,
    }));
  }

  async listAllQuizzes(): Promise<QuizListItem[]> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `SELECT q.id, q.title, q.category, q.starts_at, q.duration_minutes, q.level,
              q.is_visible,
              COUNT(DISTINCT qe.user_id) AS enrolled_count
       FROM quizzes q
       LEFT JOIN quiz_enrollments qe ON qe.quiz_id = q.id
       GROUP BY q.id
       ORDER BY q.starts_at DESC`,
    );
    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      startsAtIso: new Date(row.starts_at).toISOString(),
      durationMinutes: row.duration_minutes,
      level: row.level,
      enrolledCount: parseInt(row.enrolled_count) || 0,
      isVisible: row.is_visible !== false,
    }));
  }

  /** Admin: toggle quiz visibility (hidden quizzes won't show for users). */
  async updateQuizVisibility(quizId: string, visible: boolean): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();

    const check = await pool.query(`SELECT id FROM quizzes WHERE id = $1`, [quizId]);
    if (!check.rows[0]) throw new NotFoundException('Quiz not found');

    await pool.query(
      `UPDATE quizzes SET is_visible = $2, updated_at = NOW() WHERE id = $1`,
      [quizId, visible],
    );

    return { success: true };
  }

  /** Admin: update quiz metadata (title, description, category, level, durationMinutes, imageUrl). */
  async updateQuizMetadata(quizId: string, payload: any): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();

    const check = await pool.query(`SELECT winners_declared_at FROM quizzes WHERE id = $1`, [quizId]);
    const row = check.rows[0];
    if (!row) throw new NotFoundException('Quiz not found');

    // Don't allow edits if winners are declared
    if (row.winners_declared_at) {
      throw new BadRequestException('Cannot edit quiz after winners are declared');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (payload.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(payload.title);
      paramIndex++;
    }
    if (payload.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(payload.description);
      paramIndex++;
    }
    if (payload.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      values.push(payload.category);
      paramIndex++;
    }
    if (payload.level !== undefined) {
      updates.push(`level = $${paramIndex}`);
      values.push(payload.level);
      paramIndex++;
    }
    if (payload.durationMinutes !== undefined) {
      updates.push(`duration_minutes = $${paramIndex}`);
      values.push(payload.durationMinutes);
      paramIndex++;
    }
    if (payload.imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex}`);
      values.push(payload.imageUrl || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      return { success: true }; // No changes
    }

    updates.push('updated_at = NOW()');
    values.push(quizId);

    await pool.query(
      `UPDATE quizzes SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );

    return { success: true };
  }

  /**
   * Admin: Create (or replace) the enrollment form for a quiz.
   * fields is an array of { id, label, type, required, options? }
   */
  async setEnrollmentForm(
    quizId: string,
    fields: Array<{
      id: string;
      label: string;
      type: 'text' | 'email' | 'phone' | 'number' | 'select';
      required: boolean;
      options?: string[];
    }>,
  ): Promise<{ formId: string; fields: any[] }> {
    const pool = this.databaseService.getPool();

    // Ensure quiz exists
    const quizCheck = await pool.query(`SELECT enrollment_form_id FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizCheck.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    const existingFormId: string | null = quizCheck.rows[0].enrollment_form_id ?? null;

    // If enrollments already exist, keep form schema backward compatible.
    const enrolledResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM quiz_enrollments WHERE quiz_id = $1`,
      [quizId],
    );
    const enrolledCount = enrolledResult.rows[0]?.count ?? 0;

    if (existingFormId && enrolledCount > 0) {
      const existingFormResult = await pool.query(`SELECT fields FROM forms WHERE id = $1`, [existingFormId]);
      const existingFields: Array<{ id: string; type: string; required?: boolean }> = existingFormResult.rows[0]?.fields ?? [];

      const oldById = new Map(existingFields.map((f) => [f.id, f]));
      const nextById = new Map(fields.map((f) => [f.id, f]));

      // Existing fields cannot be removed or change type once users have enrolled.
      for (const oldField of existingFields) {
        const nextField = nextById.get(oldField.id);
        if (!nextField) {
          throw new BadRequestException(
            `Cannot remove field "${oldField.id}" after users have enrolled.`,
          );
        }
        if (String(nextField.type) !== String(oldField.type)) {
          throw new BadRequestException(
            `Cannot change type for field "${oldField.id}" after users have enrolled.`,
          );
        }
      }

      // New required fields would make existing enrollment records incomplete.
      for (const nextField of fields) {
        const oldField = oldById.get(nextField.id);
        if (!oldField && nextField.required) {
          throw new BadRequestException(
            `Cannot add new required field "${nextField.id}" after users have enrolled. Add it as optional.`,
          );
        }
      }
    }

    if (existingFormId) {
      // Update the existing form's fields
      await pool.query(
        `UPDATE forms SET fields = $2::jsonb, title = $3 WHERE id = $1`,
        [existingFormId, JSON.stringify(fields), `Enrollment Form — ${quizId}`],
      );
      return { formId: existingFormId, fields };
    }

    // Create a new form and link it to the quiz
    const formId = randomUUID();
    await pool.query(
      `INSERT INTO forms (id, title, fields) VALUES ($1, $2, $3::jsonb)`,
      [formId, `Enrollment Form — ${quizId}`, JSON.stringify(fields)],
    );
    await pool.query(
      `UPDATE quizzes SET enrollment_form_id = $1 WHERE id = $2`,
      [formId, quizId],
    );

    return { formId, fields };
  }

  /** Admin: mark quiz as started immediately (sets starts_at = now) */
  async startQuiz(quizId: string): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();

    const check = await pool.query(`SELECT id FROM quizzes WHERE id = $1`, [quizId]);
    if (!check.rows[0]) throw new NotFoundException('Quiz not found');

    await pool.query(`UPDATE quizzes SET starts_at = NOW() WHERE id = $1`, [quizId]);
    return { success: true };
  }

  /** Admin: update quiz schedule (start time and/or duration). */
  async updateQuizSchedule(
    quizId: string,
    body: { startsAt?: string; durationMinutes?: number },
  ): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();

    const check = await pool.query(
      `SELECT id, winners_declared_at FROM quizzes WHERE id = $1`,
      [quizId],
    );
    if (!check.rows[0]) throw new NotFoundException('Quiz not found');

    if (check.rows[0].winners_declared_at) {
      throw new BadRequestException('Cannot change schedule after winners are declared');
    }

    const updates: string[] = [];
    const values: any[] = [quizId];

    if (body.startsAt !== undefined) {
      const startsAt = new Date(body.startsAt);
      if (isNaN(startsAt.getTime())) {
        throw new BadRequestException('startsAt must be a valid ISO date string');
      }
      values.push(startsAt.toISOString());
      updates.push(`starts_at = $${values.length}`);
    }

    if (body.durationMinutes !== undefined) {
      const duration = Number(body.durationMinutes);
      if (!Number.isFinite(duration) || duration < 1) {
        throw new BadRequestException('durationMinutes must be a positive number');
      }
      values.push(Math.floor(duration));
      updates.push(`duration_minutes = $${values.length}`);
    }

    if (updates.length === 0) {
      throw new BadRequestException('At least one of startsAt or durationMinutes is required');
    }

    await pool.query(
      `UPDATE quizzes SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
      values,
    );

    return { success: true };
  }

  // ─── Winners & Reports ───────────────────────────────────────────────────

  /** Admin: officially declare winners for a quiz (top-3 by max score). */
  async adminDeclareWinners(quizId: string, adminId: number) {
    const pool = this.databaseService.getPool();

    const quizRes = await pool.query(
      `SELECT id, title, starts_at, winners_declared_at FROM quizzes WHERE id = $1`,
      [quizId],
    );
    if (!quizRes.rows[0]) throw new NotFoundException('Quiz not found');

    const quiz = quizRes.rows[0];
    if (quiz.winners_declared_at) {
      throw new BadRequestException('Winners have already been declared for this quiz');
    }

    const startsAt = new Date(quiz.starts_at).getTime();
    if (Date.now() < startsAt) {
      throw new BadRequestException('Cannot declare winners before the quiz has started');
    }

    // Fetch top-3 participants by max score
    const topResult = await pool.query(
      `SELECT u.id as user_id, u.name, u.roll_number, MAX(qa.score) as score,
              ROW_NUMBER() OVER (ORDER BY MAX(qa.score) DESC) as rank
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.id
       WHERE qa.quiz_id = $1
       GROUP BY u.id, u.name, u.roll_number
       ORDER BY score DESC
       LIMIT 3`,
      [quizId],
    );

    await pool.query(
      `UPDATE quizzes SET winners_declared_at = NOW(), winners_declared_by = $2 WHERE id = $1`,
      [quizId, adminId],
    );

    return {
      success: true,
      quizTitle: quiz.title,
      winners: topResult.rows.map((r: any) => ({
        rank: parseInt(r.rank),
        user: r.name || r.roll_number,
        rollNumber: r.roll_number,
        score: parseInt(r.score) || 0,
      })),
    };
  }

  /** Get officially declared winners for a quiz. */
  async getWinners(quizId: string) {
    const pool = this.databaseService.getPool();

    const quizRes = await pool.query(
      `SELECT id, title, winners_declared_at FROM quizzes WHERE id = $1`,
      [quizId],
    );
    if (!quizRes.rows[0]) throw new NotFoundException('Quiz not found');

    const quiz = quizRes.rows[0];
    if (!quiz.winners_declared_at) {
      return { declared: false, quizTitle: quiz.title, winners: [] };
    }

    const topResult = await pool.query(
      `SELECT u.name, u.roll_number, MAX(qa.score) as score,
              ROW_NUMBER() OVER (ORDER BY MAX(qa.score) DESC) as rank
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.id
       WHERE qa.quiz_id = $1
       GROUP BY u.name, u.roll_number
       ORDER BY score DESC
       LIMIT 3`,
      [quizId],
    );

    return {
      declared: true,
      declaredAt: new Date(quiz.winners_declared_at).toISOString(),
      quizTitle: quiz.title,
      winners: topResult.rows.map((r: any) => ({
        rank: parseInt(r.rank),
        user: r.name || r.roll_number,
        rollNumber: r.roll_number,
        score: parseInt(r.score) || 0,
      })),
    };
  }

  /** Admin: detailed report for a single quiz. */
  async adminGetQuizReport(quizId: string) {
    const pool = this.databaseService.getPool();

    const quizRes = await pool.query(
      `SELECT id, title, category, level, starts_at, duration_minutes,
              winners_declared_at, winners_declared_by
       FROM quizzes WHERE id = $1`,
      [quizId],
    );
    if (!quizRes.rows[0]) throw new NotFoundException('Quiz not found');
    const quiz = quizRes.rows[0];

    const [enrollRow, attemptsRow, topScorersRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed
         FROM quiz_enrollments WHERE quiz_id = $1`,
        [quizId],
      ),
      pool.query(
        `SELECT COUNT(*) as total, COALESCE(AVG(score),0) as avg_score, COALESCE(MAX(score),0) as max_score
         FROM quiz_attempts WHERE quiz_id = $1`,
        [quizId],
      ),
      pool.query(
        `SELECT u.name, u.roll_number, MAX(qa.score) as score,
                ROW_NUMBER() OVER (ORDER BY MAX(qa.score) DESC) as rank
         FROM quiz_attempts qa
         JOIN users u ON qa.user_id = u.id
         WHERE qa.quiz_id = $1
         GROUP BY u.name, u.roll_number
         ORDER BY score DESC
         LIMIT 10`,
        [quizId],
      ),
    ]);

    const winnerInfo = await this.getWinners(quizId);

    return {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        category: quiz.category,
        level: quiz.level,
        startsAtIso: new Date(quiz.starts_at).toISOString(),
        durationMinutes: quiz.duration_minutes,
        winnersDeclared: !!quiz.winners_declared_at,
        winnersDeclaredAt: quiz.winners_declared_at ? new Date(quiz.winners_declared_at).toISOString() : null,
      },
      stats: {
        totalEnrolled: parseInt(enrollRow.rows[0].total) || 0,
        totalCompleted: parseInt(enrollRow.rows[0].completed) || 0,
        totalAttempts: parseInt(attemptsRow.rows[0].total) || 0,
        avgScore: Math.round(parseFloat(attemptsRow.rows[0].avg_score) || 0),
        maxScore: parseInt(attemptsRow.rows[0].max_score) || 0,
      },
      topScorers: topScorersRes.rows.map((r: any) => ({
        rank: parseInt(r.rank),
        user: r.name || r.roll_number,
        rollNumber: r.roll_number,
        score: parseInt(r.score) || 0,
      })),
      winners: winnerInfo,
    };
  }

  /** Public: get the enrollment form (fields only) for a quiz */
  async getEnrollmentForm(quizId: string): Promise<{ formId: string; fields: any[] } | null> {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT f.id as form_id, f.fields
       FROM quizzes q
       JOIN forms f ON f.id = q.enrollment_form_id
       WHERE q.id = $1`,
      [quizId],
    );

    if (!result.rows[0]) return null;

    return {
      formId: result.rows[0].form_id,
      fields: result.rows[0].fields ?? [],
    };
  }
}
