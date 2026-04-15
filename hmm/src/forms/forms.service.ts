import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service.js';

/** Strip HTML tags from a string to prevent injection via field labels. */
function sanitizeString(value: unknown): string {
  return String(value ?? '').replace(/<[^>]*>/g, '').trim();
}

@Injectable()
export class FormsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(form: any) {
    const id = randomUUID();
    const title = sanitizeString(form?.title ?? 'Untitled Form');
    const rawFields: any[] = Array.isArray(form?.fields) ? form.fields : [];

    const fields = rawFields.map((f) => ({
      ...f,
      label: sanitizeString(f?.label),
      id: sanitizeString(f?.id),
      options: Array.isArray(f?.options) ? f.options.map(sanitizeString) : undefined,
    }));

    await this.databaseService
      .getPool()
      .query('INSERT INTO forms (id, title, fields) VALUES ($1, $2, $3::jsonb)', [
        id,
        title,
        JSON.stringify(fields),
      ]);

    return { id, title, fields };
  }

  async findAll() {
    const result = await this.databaseService
      .getPool()
      .query('SELECT id, title, fields FROM forms ORDER BY created_at DESC');

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      fields: row.fields ?? [],
    }));
  }

  async findOne(id: string) {
    const result = await this.databaseService
      .getPool()
      .query('SELECT id, title, fields FROM forms WHERE id = $1 LIMIT 1', [id]);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      fields: row.fields ?? [],
    };
  }
}