import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface User {
  id: number;
  roll_number: string;
  email?: string;
  name?: string;
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
  ): Promise<User> {
    const result = await this.databaseService.getPool().query(
      `INSERT INTO users (roll_number, name, email, role) 
       VALUES ($1, $2, $3, 'user') 
       RETURNING *`,
      [rollNumber, name || null, email || null],
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
