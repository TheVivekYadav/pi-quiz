import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service.js';
import { toPublicQuizId } from './quiz-utils.js';
import { QuizDetail, QuizListItem, QuizQuestion } from './quiz.service.js';

@Injectable()
export class QuizAdminService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async generateQuizShortId(maxAttempts = 50): Promise<string> {
    const pool = this.databaseService.getPool();

    for (let i = 0; i < maxAttempts; i++) {
      const candidate = String(Math.floor(Math.random() * 9000) + 1000);
      const exists = await pool.query(`SELECT 1 FROM quizzes WHERE short_id = $1 LIMIT 1`, [candidate]);
      if (!exists.rows[0]) {
        return candidate;
      }
    }

    throw new BadRequestException('Could not generate a unique short quiz URL. Please retry.');
  }

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
    imageMode?: 'banner' | 'poster';
  }): Promise<QuizDetail> {
    const pool = this.databaseService.getPool();
    const id = randomUUID();
    let shortId = '';
    let inserted = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      shortId = await this.generateQuizShortId();
      try {
        await pool.query(
          `INSERT INTO quizzes
             (id, short_id, title, topic, category, level, duration_minutes, starts_at, description, expectations, curator_note, image_url, image_mode, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            id,
            shortId,
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
            body.imageMode ?? 'banner',
            createdByUserId,
          ],
        );
        inserted = true;
        break;
      } catch (error: any) {
        if (error?.code === '23505' && String(error?.constraint || '').includes('short_id')) {
          continue;
        }
        throw error;
      }
    }

    if (!inserted) {
      throw new BadRequestException('Could not generate a short quiz URL. Please retry.');
    }

    return {
      id: shortId,
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
      imageMode: body.imageMode ?? 'banner',
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

    const quizCheck = await pool.query(`SELECT id FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizCheck.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    const indexResult = await pool.query(
      `SELECT COALESCE(MAX(question_index), 0) + 1 AS next_index FROM quiz_questions WHERE quiz_id = $1`,
      [quizId],
    );
    const questionIndex = parseInt(indexResult.rows[0].next_index);

    const qId = randomUUID();
    const points = body.points ?? 1;

    await pool.query(
      `INSERT INTO quiz_questions
         (id, quiz_id, question_text, image_url, options, correct_option_id, points, question_index)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        qId,
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
      id: qId,
      text: body.text,
      imageUrl: body.imageUrl,
      options: body.options,
      points,
    };
  }

  async deleteQuiz(quizId: string): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const check = await client.query(`SELECT id FROM quizzes WHERE id = $1`, [quizId]);
      if (!check.rows[0]) {
        throw new NotFoundException('Quiz not found');
      }

      await client.query(
        `DELETE FROM quiz_responses
         WHERE question_id IN (SELECT id FROM quiz_questions WHERE quiz_id = $1)`,
        [quizId],
      );

      await client.query(`DELETE FROM quizzes WHERE id = $1`, [quizId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { success: true };
  }

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

  async deleteQuestion(quizId: string, questionId: string): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const check = await client.query(
        `SELECT id FROM quiz_questions WHERE id = $1 AND quiz_id = $2`,
        [questionId, quizId],
      );
      if (!check.rows[0]) throw new NotFoundException('Question not found');

      await client.query(`DELETE FROM quiz_responses WHERE question_id = $1`, [questionId]);

      await client.query(
        `DELETE FROM quiz_questions WHERE id = $1 AND quiz_id = $2`,
        [questionId, quizId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { success: true };
  }

  async adminGetQuizResponses(quizId: string) {
    const pool = this.databaseService.getPool();

    const questionsResult = await pool.query(
      `SELECT id, question_text, options, correct_option_id, question_index
       FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_index ASC`,
      [quizId],
    );

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

  async getQuizEnrollments(quizId: string) {
    const pool = this.databaseService.getPool();

    const quizCheck = await pool.query(`SELECT id, enrollment_form_id FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizCheck.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    const formId = quizCheck.rows[0].enrollment_form_id;

    const enrollmentsResult = await pool.query(
      `SELECT qe.user_id, qe.enrolled_at, qe.form_response_id, u.id, u.name, u.roll_number
       FROM quiz_enrollments qe
       JOIN users u ON qe.user_id = u.id
       WHERE qe.quiz_id = $1
       ORDER BY qe.enrolled_at DESC`,
      [quizId],
    );

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
          `SELECT id, answers FROM responses WHERE id = ANY($1::text[])`,
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
      formFields,
      enrollments,
    };
  }

  async adminRemoveEnrollment(quizId: string, userId: number): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const quizCheck = await client.query(`SELECT id FROM quizzes WHERE id = $1`, [quizId]);
      if (!quizCheck.rows[0]) throw new NotFoundException('Quiz not found');

      const enrollmentResult = await client.query(
        `SELECT id, form_response_id FROM quiz_enrollments WHERE quiz_id = $1 AND user_id = $2`,
        [quizId, userId],
      );
      const enrollment = enrollmentResult.rows[0];
      if (!enrollment) throw new NotFoundException('Enrollment not found');

      const attemptsResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2`,
        [quizId, userId],
      );
      const attemptsCount = attemptsResult.rows[0]?.count ?? 0;
      if (attemptsCount > 0) {
        throw new BadRequestException('Cannot remove enrollment after user has attempted this quiz');
      }

      await client.query(`DELETE FROM quiz_enrollments WHERE id = $1`, [enrollment.id]);

      if (enrollment.form_response_id) {
        await client.query(`DELETE FROM responses WHERE id = $1`, [enrollment.form_response_id]);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listAllQuizzes(): Promise<QuizListItem[]> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `SELECT q.id, q.short_id, q.title, q.category, q.starts_at, q.duration_minutes, q.level,
              q.is_visible,
              COUNT(DISTINCT qe.user_id) AS enrolled_count
       FROM quizzes q
       LEFT JOIN quiz_enrollments qe ON qe.quiz_id = q.id
       GROUP BY q.id
       ORDER BY q.starts_at DESC`,
    );
    return result.rows.map((row: any) => ({
      id: toPublicQuizId(row),
      title: row.title,
      category: row.category,
      startsAtIso: new Date(row.starts_at).toISOString(),
      durationMinutes: row.duration_minutes,
      level: row.level,
      enrolledCount: parseInt(row.enrolled_count) || 0,
      isVisible: row.is_visible !== false,
    }));
  }

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

  async updateQuizMetadata(quizId: string, payload: any): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();

    const check = await pool.query(`SELECT winners_declared_at FROM quizzes WHERE id = $1`, [quizId]);
    const row = check.rows[0];
    if (!row) throw new NotFoundException('Quiz not found');

    if (row.winners_declared_at) {
      throw new BadRequestException('Cannot edit quiz after winners are declared');
    }

    if (payload.enrollmentStartsAt !== undefined && payload.enrollmentStartsAt !== null && payload.enrollmentStartsAt !== '') {
      const parsed = new Date(payload.enrollmentStartsAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('enrollmentStartsAt must be a valid ISO date');
      }
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
    if (payload.imageMode !== undefined) {
      updates.push(`image_mode = $${paramIndex}`);
      values.push(payload.imageMode || 'banner');
      paramIndex++;
    }
    if (payload.enrollmentEnabled !== undefined) {
      updates.push(`enrollment_enabled = $${paramIndex}`);
      values.push(!!payload.enrollmentEnabled);
      paramIndex++;
    }
    if (payload.enrollmentStartsAt !== undefined) {
      updates.push(`enrollment_starts_at = $${paramIndex}`);
      values.push(payload.enrollmentStartsAt ? new Date(payload.enrollmentStartsAt).toISOString() : null);
      paramIndex++;
    }

    if (updates.length === 0) {
      return { success: true };
    }

    updates.push('updated_at = NOW()');
    values.push(quizId);

    await pool.query(
      `UPDATE quizzes SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );

    return { success: true };
  }

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

    const quizCheck = await pool.query(`SELECT enrollment_form_id FROM quizzes WHERE id = $1`, [quizId]);
    if (!quizCheck.rows[0]) {
      throw new NotFoundException('Quiz not found');
    }

    const existingFormId: string | null = quizCheck.rows[0].enrollment_form_id ?? null;

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
      await pool.query(
        `UPDATE forms SET fields = $2::jsonb, title = $3 WHERE id = $1`,
        [existingFormId, JSON.stringify(fields), `Enrollment Form — ${quizId}`],
      );
      return { formId: existingFormId, fields };
    }

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

  /** Admin: mark quiz as started immediately (sets starts_at = now). #11 – also updates updated_at. */
  async startQuiz(quizId: string): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();

    const check = await pool.query(`SELECT id FROM quizzes WHERE id = $1`, [quizId]);
    if (!check.rows[0]) throw new NotFoundException('Quiz not found');

    await pool.query(`UPDATE quizzes SET starts_at = NOW(), updated_at = NOW() WHERE id = $1`, [quizId]);
    return { success: true };
  }

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

    const topResult = await pool.query(
      `SELECT u.id as user_id, u.name, u.roll_number, MAX(qa.score) as score,
              MIN(qa.submitted_at) as first_submitted_at,
              DENSE_RANK() OVER (ORDER BY MAX(qa.score) DESC) as rank
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.id
       WHERE qa.quiz_id = $1
       GROUP BY u.id, u.name, u.roll_number
       ORDER BY score DESC, first_submitted_at ASC, u.roll_number ASC
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

  async adminGetQuizReport(quizId: string) {
    const pool = this.databaseService.getPool();

    const quizRes = await pool.query(
      `SELECT id, short_id, title, category, level, starts_at, duration_minutes,
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
                MIN(qa.submitted_at) as first_submitted_at,
                DENSE_RANK() OVER (ORDER BY MAX(qa.score) DESC) as rank
         FROM quiz_attempts qa
         JOIN users u ON qa.user_id = u.id
         WHERE qa.quiz_id = $1
         GROUP BY u.name, u.roll_number
         ORDER BY score DESC, first_submitted_at ASC, u.roll_number ASC
         LIMIT 10`,
        [quizId],
      ),
    ]);

    // Fetch winners inline (avoids cross-service dependency)
    const quizWinnerRes = await pool.query(
      `SELECT id, title, winners_declared_at FROM quizzes WHERE id = $1`,
      [quizId],
    );
    let winnerInfo: any;
    if (!quizWinnerRes.rows[0]?.winners_declared_at) {
      winnerInfo = { declared: false, quizTitle: quiz.title, winners: [] };
    } else {
      const topWinnersResult = await pool.query(
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
      winnerInfo = {
        declared: true,
        declaredAt: new Date(quizWinnerRes.rows[0].winners_declared_at).toISOString(),
        quizTitle: quiz.title,
        winners: topWinnersResult.rows.map((r: any) => ({
          rank: parseInt(r.rank),
          user: r.name || r.roll_number,
          rollNumber: r.roll_number,
          score: parseInt(r.score) || 0,
        })),
      };
    }

    return {
      quiz: {
        id: toPublicQuizId(quiz),
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

  async getForbiddenQuizForAdmin(quizId: string): Promise<boolean> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(`SELECT 1 FROM quizzes WHERE id = $1`, [quizId]);
    return !!result.rows[0];
  }
}
