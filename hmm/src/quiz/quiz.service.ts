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
       WHERE starts_at >= NOW()
       ORDER BY starts_at ASC
       LIMIT 6`,
    );

    // Get categories
    const categoriesResult = await pool.query(
      `SELECT DISTINCT category FROM quizzes ORDER BY category`,
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
       WHERE starts_at >= NOW()
       ORDER BY starts_at ASC
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
      enrollmentForm: quiz.form_id
        ? { id: quiz.form_id, fields: quiz.form_fields ?? [] }
        : null,
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
    const quizStartRes = await pool.query(`SELECT starts_at FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizStartRes.rows[0]) throw new NotFoundException('Quiz not found');
    const startsAt = new Date(quizStartRes.rows[0].starts_at).getTime();
    const now = Date.now();
    if (now < startsAt) {
      throw new ForbiddenException('Quiz has not started yet');
    }
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
      `SELECT id, attempts_count, locked_until FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );
    if (!enrolRes.rows[0]) {
      throw new BadRequestException('User not enrolled in this quiz');
    }

    const enrollment = enrolRes.rows[0];
    const MAX_ATTEMPTS = 2;
    const LOCK_MINUTES = 15;

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

    // If attempts reached limit, set temporary lockout for subsequent attempts
    const attemptsRow = await pool.query(
      `SELECT attempts_count FROM quiz_enrollments WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId],
    );
    const attemptsCount = parseInt(attemptsRow.rows[0].attempts_count) || 0;
    const MAX_ATTEMPTS = 2;
    const LOCK_MINUTES = 15;
    if (attemptsCount >= MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE quiz_enrollments SET locked_until = NOW() + ($1 || ' minutes')::interval WHERE user_id = $2 AND quiz_id = $3`,
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
        timeTakenMinutes: 0,
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
  }): Promise<QuizDetail> {
    const pool = this.databaseService.getPool();
    const id = randomUUID();

    await pool.query(
      `INSERT INTO quizzes
         (id, title, topic, category, level, duration_minutes, starts_at, description, expectations, curator_note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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

  async listAllQuizzes(): Promise<QuizListItem[]> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `SELECT id, title, category, starts_at, duration_minutes, level FROM quizzes ORDER BY starts_at DESC`,
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
