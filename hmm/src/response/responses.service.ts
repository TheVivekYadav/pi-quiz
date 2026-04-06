// responses/responses.service.ts

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ResponsesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(response: any) {
    const formId = String(response?.formId ?? '').trim();
    if (!formId) {
      throw new BadRequestException('formId is required');
    }

    const answers = response?.answers ?? {};
    const submittedAt = response?.submittedAt
      ? new Date(response.submittedAt)
      : new Date();

    if (Number.isNaN(submittedAt.getTime())) {
      throw new BadRequestException('submittedAt is invalid');
    }

    const id = randomUUID();

    try {
      await this.databaseService.getPool().query(
        'INSERT INTO responses (id, form_id, answers, submitted_at) VALUES ($1, $2, $3::jsonb, $4)',
        [id, formId, JSON.stringify(answers), submittedAt.toISOString()],
      );
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new NotFoundException('Form not found');
      }
      throw error;
    }

    return {
      id,
      formId,
      answers,
      submittedAt: submittedAt.toISOString(),
    };
  }

  async findAll() {
    const result = await this.databaseService.getPool().query(
      'SELECT id, form_id AS "formId", answers, submitted_at AS "submittedAt" FROM responses ORDER BY submitted_at DESC',
    );

    return result.rows;
  }

  async findByForm(formId: string) {
    const result = await this.databaseService.getPool().query(
      'SELECT id, form_id AS "formId", answers, submitted_at AS "submittedAt" FROM responses WHERE form_id = $1 ORDER BY submitted_at DESC',
      [formId],
    );

    return result.rows;
  }
}