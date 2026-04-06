import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class FormsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(form: any) {
    const id = randomUUID();
    const title = String(form?.title ?? 'Untitled Form');
    const fields = Array.isArray(form?.fields) ? form.fields : [];

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