import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service.js';
import { toPublicQuizId } from './quiz-utils.js';

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
  imageMode?: 'banner' | 'poster';
  enrollmentEnabled?: boolean;
  enrollmentStartsAtIso?: string | null;
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

  async resolveQuizRef(quizRef: string): Promise<string> {
    const ref = String(quizRef ?? '').trim();
    if (!ref) {
      throw new NotFoundException('Quiz not found');
    }

    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `SELECT id FROM quizzes WHERE id = $1 OR short_id = $1 LIMIT 1`,
      [ref],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    return result.rows[0].id;
  }

  async getHome(userId: number) {
    const pool = this.databaseService.getPool();

    const enrolledResult = await pool.query(
      `SELECT q.id, q.short_id, q.title, q.category,
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

    const featuredResult = await pool.query(
      `SELECT id, short_id, title, category, starts_at, duration_minutes, level FROM quizzes
       WHERE starts_at >= NOW() AND is_visible = TRUE
       ORDER BY starts_at ASC
       LIMIT 6`,
    );

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
          id: toPublicQuizId(q),
          title: q.title,
          category: q.category,
          progress,
        };
      }),
      categories: categoriesResult.rows.map((r: any) => r.category),
      featuredQuizzes: featuredResult.rows.map((q: any) => ({
        id: toPublicQuizId(q),
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
          `SELECT q.id, q.short_id, q.title, q.category, q.starts_at,
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
          id: toPublicQuizId(r),
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

    const attemptsResult = await pool.query(
      `SELECT COUNT(*) as total, SUM(score) as totalScore FROM quiz_attempts WHERE user_id = $1`,
      [userId],
    );

    const enrolledResult = await pool.query(
      `SELECT COUNT(*) as count FROM quiz_enrollments WHERE user_id = $1`,
      [userId],
    );

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
      `SELECT id, short_id, title, category, starts_at, duration_minutes, level FROM quizzes
       WHERE starts_at >= NOW() AND is_visible = TRUE
       ORDER BY starts_at ASC
       LIMIT 10`,
    );

    return result.rows.map((row: any) => ({
      id: toPublicQuizId(row),
      title: row.title,
      category: row.category,
      startsAtIso: new Date(row.starts_at).toISOString(),
      durationMinutes: row.duration_minutes,
      level: row.level,
    }));
  }

  /**
   * Get quiz details.
   * #7 – Hidden quizzes (is_visible = false) are surfaced as 404 for non-admin callers,
   * preventing information disclosure to users who know the quiz ID.
   */
  async getQuizDetail(
    quizId: string,
    isAdmin = false,
  ): Promise<QuizDetail & { enrollmentForm: { id: string; fields: any[] } | null }> {
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT q.*, q.short_id, f.id as form_id, f.fields as form_fields
       FROM quizzes q
       LEFT JOIN forms f ON f.id = q.enrollment_form_id
       WHERE q.id = $1`,
      [quizId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    const quiz = result.rows[0];

    if (quiz.is_visible === false && !isAdmin) {
      throw new NotFoundException('Quiz not found');
    }

    return {
      id: toPublicQuizId(quiz),
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
      imageMode: quiz.image_mode === 'poster' ? 'poster' : 'banner',
      enrollmentEnabled: quiz.enrollment_enabled !== false,
      enrollmentStartsAtIso: quiz.enrollment_starts_at ? new Date(quiz.enrollment_starts_at).toISOString() : null,
      enrollmentForm: quiz.form_id
        ? { id: quiz.form_id, fields: quiz.form_fields ?? [] }
        : null,
    };
  }

  async getLobby(quizId: string, userId: number) {
    const pool = this.databaseService.getPool();

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

    const usersResult = await pool.query(
      `SELECT DISTINCT u.name, u.roll_number FROM quiz_enrollments qe
       JOIN users u ON qe.user_id = u.id
       WHERE qe.quiz_id = $1
       LIMIT 10`,
      [quizId],
    );

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

    const quizStartRes = await pool.query(`SELECT starts_at, duration_minutes FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizStartRes.rows[0]) throw new NotFoundException('Quiz not found');
    const startsAt = new Date(quizStartRes.rows[0].starts_at).getTime();
    const durationMinutes: number = parseInt(quizStartRes.rows[0].duration_minutes) || 30;
    const now = Date.now();
    if (now < startsAt) {
      throw new ForbiddenException('Quiz has not started yet');
    }

    const completedCheck = await pool.query(
      `SELECT is_completed FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );
    if (completedCheck.rows[0]?.is_completed) {
      throw new ForbiddenException('You have already completed this quiz');
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM quiz_questions WHERE quiz_id = $1`,
      [quizId],
    );
    const total = parseInt(countResult.rows[0].total);

    const totalSeconds = durationMinutes * 60;
    const timerSeconds = total > 0
      ? Math.min(120, Math.max(10, Math.floor(totalSeconds / total)))
      : 30;

    const questionResult = await pool.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 AND question_index = $2`,
      [quizId, questionIndex],
    );

    if (!questionResult.rows[0]) {
      throw new NotFoundException('Question not found');
    }

    const q = questionResult.rows[0];

    return {
      question: {
        id: q.id,
        text: q.question_text,
        imageUrl: q.image_url,
        options: q.options || [],
        points: q.points,
      },
      current: questionIndex,
      total,
      timerSeconds,
      highPoints: q.points > 5,
    };
  }

  /**
   * Submit quiz answers.
   * #3 – The enrollment check, attempt insertion, response insertion, and enrollment
   * update are wrapped in a single transaction with SELECT … FOR UPDATE on the
   * enrollment row.  This prevents two concurrent requests from both passing the
   * attempt-count check and both persisting an attempt, which would exceed MAX_ATTEMPTS.
   */
  async submitQuiz(
    quizId: string,
    userId: number,
    answers: Record<string, string>,
    startedAtIso?: string,
  ): Promise<QuizSubmitPayload> {
    const pool = this.databaseService.getPool();
    const MAX_ATTEMPTS = 2;
    const LOCK_MINUTES = 15;

    // Compute time taken (no DB needed)
    const submittedAt = Date.now();
    let timeTakenMinutes = 0;
    if (startedAtIso) {
      const startedAt = new Date(startedAtIso).getTime();
      if (!isNaN(startedAt) && startedAt < submittedAt) {
        timeTakenMinutes = Math.min(120, Math.round((submittedAt - startedAt) / 60_000));
      }
    }

    // Verify quiz exists and has started (read-only, no lock needed)
    const quizStartRes = await pool.query(`SELECT starts_at FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizStartRes.rows[0]) throw new NotFoundException('Quiz not found');
    const startsAt = new Date(quizStartRes.rows[0].starts_at).getTime();
    if (Date.now() < startsAt) {
      throw new ForbiddenException('Quiz has not started yet');
    }

    // Fetch questions outside the transaction (read-only)
    const questionsResult = await pool.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_index ASC`,
      [quizId],
    );
    const questions = questionsResult.rows;

    // Calculate score outside the transaction (no DB needed)
    let score = 0;
    let correct = 0;
    let incorrect = 0;
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

    // Wrap the critical section in a transaction with a row-level lock so concurrent
    // submissions cannot both pass the attempt-count check.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const enrolRes = await client.query(
        `SELECT id, attempts_count, locked_until, is_completed
         FROM quiz_enrollments
         WHERE user_id = $1 AND quiz_id = $2
         FOR UPDATE`,
        [userId, quizId],
      );
      if (!enrolRes.rows[0]) {
        throw new BadRequestException('User not enrolled in this quiz');
      }

      const enrollment = enrolRes.rows[0];

      if (enrollment.is_completed) {
        throw new ForbiddenException('You have already completed this quiz');
      }

      if (enrollment.locked_until) {
        const lockedUntil = new Date(enrollment.locked_until).getTime();
        if (Date.now() < lockedUntil) {
          const remainingSeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
          throw new ForbiddenException(`Too many attempts. Locked for ${remainingSeconds} seconds.`);
        }
      }

      const currentCount = parseInt(enrollment.attempts_count) || 0;
      if (currentCount >= MAX_ATTEMPTS) {
        throw new ForbiddenException('You have already completed this quiz');
      }

      // Save attempt
      await client.query(
        `INSERT INTO quiz_attempts (id, user_id, quiz_id, score, total, accuracy_rate)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [attemptId, userId, quizId, score, total, accuracyRate],
      );

      // Save individual responses
      for (const question of questions) {
        const selectedOptionId = answers[question.id] || null;
        if (selectedOptionId) {
          await client.query(
            `INSERT INTO quiz_responses (id, attempt_id, question_id, selected_option_id)
             VALUES ($1, $2, $3, $4)`,
            [randomUUID(), attemptId, question.id, selectedOptionId],
          );
        }
      }

      // Increment attempts and mark completed if limit reached
      const newCount = currentCount + 1;
      if (newCount >= MAX_ATTEMPTS) {
        await client.query(
          `UPDATE quiz_enrollments
           SET is_completed = TRUE, completed_at = NOW(),
               attempts_count = $1,
               locked_until = NOW() + ($2 || ' minutes')::interval
           WHERE user_id = $3 AND quiz_id = $4`,
          [newCount, String(LOCK_MINUTES), userId, quizId],
        );
      } else {
        await client.query(
          `UPDATE quiz_enrollments
           SET attempts_count = $1, locked_until = NULL
           WHERE user_id = $2 AND quiz_id = $3`,
          [newCount, userId, quizId],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    // Determine badge (no DB needed)
    let badge = 'Participant';
    if (accuracyRate >= 90) badge = 'Expert';
    else if (accuracyRate >= 80) badge = 'Advanced';
    else if (accuracyRate >= 70) badge = 'Proficient';

    // Calculate percentile (read-only, outside transaction)
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
              MIN(qa.submitted_at) as first_submitted_at,
              DENSE_RANK() OVER (ORDER BY MAX(qa.score) DESC) as rank
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.id
       WHERE qa.quiz_id = $1
       GROUP BY u.id, u.name, u.roll_number
       ORDER BY score DESC, first_submitted_at ASC, u.roll_number ASC
       LIMIT 10`,
      [quizId],
    );

    return result.rows.map((row: any, idx: number) => ({
      rank: parseInt(row.rank) || idx + 1,
      user: row.name || row.roll_number || `User ${idx + 1}`,
      rollNumber: row.roll_number,
      score: parseInt(row.score) || 0,
      currentUser: row.user_id === userId,
    }));
  }

  async enrollUser(userId: number, quizId: string, formAnswers?: Record<string, any>) {
    const pool = this.databaseService.getPool();

    const visibleCheck = await pool.query(
      `SELECT is_visible, enrollment_enabled, enrollment_starts_at FROM quizzes WHERE id = $1`,
      [quizId],
    );
    if (!visibleCheck.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }
    if (!visibleCheck.rows[0].is_visible) {
      throw new ForbiddenException('This quiz is currently hidden by admin');
    }

    if (visibleCheck.rows[0].enrollment_enabled === false) {
      throw new BadRequestException('Enrollments are currently closed for this quiz.');
    }

    if (visibleCheck.rows[0].enrollment_starts_at) {
      const enrollmentStartsAt = new Date(visibleCheck.rows[0].enrollment_starts_at);
      if (!Number.isNaN(enrollmentStartsAt.getTime()) && enrollmentStartsAt.getTime() > Date.now()) {
        throw new BadRequestException(`Enrollments will open on ${enrollmentStartsAt.toISOString()}`);
      }
    }

    const quizResult = await pool.query(
      `SELECT enrollment_form_id FROM quizzes WHERE id = $1`,
      [quizId],
    );
    const enrollmentFormId: string | null = quizResult.rows[0]?.enrollment_form_id ?? null;

    if (enrollmentFormId && (!formAnswers || Object.keys(formAnswers).length === 0)) {
      throw new BadRequestException('This quiz requires you to fill out the enrollment form.');
    }

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
      const existingEnroll = await pool.query(
        `SELECT is_completed FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
        [userId, quizId],
      );
      if (existingEnroll.rows[0]?.is_completed) {
        throw new BadRequestException('You have already completed this quiz and cannot re-enroll');
      }

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
              MIN(qa.submitted_at) as first_submitted_at,
              DENSE_RANK() OVER (ORDER BY MAX(qa.score) DESC) as rank
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.id
       WHERE qa.quiz_id = $1
       GROUP BY u.name, u.roll_number
       ORDER BY score DESC, first_submitted_at ASC, u.roll_number ASC
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
