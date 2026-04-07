import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface User {
  id: number;
  roll_number: string;
  email?: string;
  name?: string;
  branch?: string;
  year?: number;
  role: 'admin' | 'user';
  created_at: string;
}

@Injectable()
export class UsersService {
  constructor(private databaseService: DatabaseService) {}

  async getUserByRollNumber(rollNumber: string): Promise<User | null> {
    const result = await this.databaseService
      .getPool()
      .query('SELECT * FROM users WHERE roll_number = $1', [rollNumber]);
    return result.rows[0] || null;
  }

  async getUserById(id: number): Promise<User | null> {
    const result = await this.databaseService
      .getPool()
      .query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createUser(
    rollNumber: string,
    name?: string,
    email?: string,
    branch?: string,
    year?: number,
  ): Promise<User> {
    const result = await this.databaseService.getPool().query(
      `INSERT INTO users (roll_number, name, email, branch, year, role)
       VALUES ($1, $2, $3, $4, $5, 'user')
       RETURNING *`,
      [rollNumber, name || null, email || null, branch || null, year || null],
    );
    return result.rows[0];
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.databaseService
      .getPool()
      .query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  }

  async updateUser(
    id: number,
    updates: Partial<Omit<User, 'id' | 'created_at'>>,
  ): Promise<User> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramCount++}`);
      values.push(updates.email);
    }
    if (updates.role !== undefined) {
      setClauses.push(`role = $${paramCount++}`);
      values.push(updates.role);
    }
    if (updates.branch !== undefined) {
      setClauses.push(`branch = $${paramCount++}`);
      values.push(updates.branch);
    }
    if (updates.year !== undefined) {
      setClauses.push(`year = $${paramCount++}`);
      values.push(updates.year);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.databaseService.getPool().query(query, values);
    return result.rows[0];
  }
}
