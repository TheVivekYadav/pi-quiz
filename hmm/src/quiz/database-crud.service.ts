import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class DatabaseCrudService {
  constructor(private readonly databaseService: DatabaseService) {}

  // #10 – app_settings is now included so admins can inspect it via the DB viewer.
  private readonly ALLOWED_TABLES = [
    'app_settings',
    'users',
    'user_sessions',
    'auth_logs',
    'api_error_logs',
    'quizzes',
    'quiz_questions',
    'quiz_enrollments',
    'quiz_attempts',
    'quiz_responses',
    'forms',
    'responses',
  ];

  private readonly TABLE_COLUMN_PRIORITIES: Record<string, string[]> = {
    users: ['id', 'roll_number', 'name', 'role'],
    quizzes: ['id', 'title', 'category', 'is_visible'],
    quiz_enrollments: ['id', 'user_id', 'quiz_id', 'is_completed'],
    quiz_attempts: ['id', 'user_id', 'quiz_id', 'submitted_at'],
    quiz_questions: ['id', 'quiz_id', 'question_index', 'points'],
    quiz_responses: ['id', 'attempt_id', 'question_id', 'selected_option_id'],
    responses: ['id', 'form_id', 'submitted_at'],
    forms: ['id', 'title', 'created_at'],
    user_sessions: ['id', 'user_id', 'platform', 'created_at'],
    auth_logs: ['id', 'user_id', 'event_type', 'created_at'],
    api_error_logs: ['id', 'method', 'path', 'status_code', 'created_at'],
    app_settings: ['key', 'value', 'updated_at'],
  };

  private validateTableName(tableName: string): void {
    if (!this.ALLOWED_TABLES.includes(tableName)) {
      throw new BadRequestException(`Table "${tableName}" is not accessible`);
    }
  }

  /** Fetch the set of valid column names for a table from information_schema. */
  private async getAllowedColumns(tableName: string): Promise<Set<string>> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [tableName],
    );
    return new Set<string>(result.rows.map((r: any) => r.column_name));
  }

  async getDatabaseTables() {
    const pool = this.databaseService.getPool();
    const tables = await Promise.all(
      this.ALLOWED_TABLES.map(async (name) => {
        const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM ${name}`);
        return {
          name,
          count: countRes.rows[0]?.count ?? 0,
        };
      }),
    );
    return tables;
  }

  async getTableSchema(tableName: string) {
    this.validateTableName(tableName);
    const pool = this.databaseService.getPool();

    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [tableName],
    );

    return {
      table: tableName,
      columns: result.rows.map((row: any) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
      })),
    };
  }

  async getTableRecords(
    tableName: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      role?: string;
      nullOnly?: boolean;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    },
  ) {
    this.validateTableName(tableName);
    const pool = this.databaseService.getPool();

    const safeLimit = Math.max(1, Math.min(200, Number(options.limit || 50)));
    const safeOffset = Math.max(0, Number(options.offset || 0));

    const schemaResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [tableName],
    );
    const columnNames: string[] = schemaResult.rows.map((r: any) => r.column_name);

    const preferred = this.TABLE_COLUMN_PRIORITIES[tableName] ?? [];
    const fallback = columnNames.filter((c) => c !== 'id').slice(0, 3);
    const displayColumns = [
      ...preferred.filter((c) => columnNames.includes(c)),
      ...fallback.filter((c) => !preferred.includes(c)),
    ].slice(0, 4);

    const whereClauses: string[] = [];
    const whereValues: any[] = [];

    if (options.search) {
      const searchColumns = displayColumns.length > 0 ? displayColumns : columnNames.slice(0, 4);
      const searchExprs = searchColumns.map((col) => `${col}::text ILIKE $${whereValues.length + 1}`);
      whereValues.push(`%${options.search}%`);
      whereClauses.push(`(${searchExprs.join(' OR ')})`);
    }

    if (options.role && columnNames.includes('role')) {
      whereValues.push(options.role);
      whereClauses.push(`role = $${whereValues.length}`);
    }

    if (options.nullOnly && displayColumns.length > 0) {
      whereClauses.push(`(${displayColumns.map((col) => `${col} IS NULL`).join(' OR ')})`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const hasSortBy = !!options.sortBy && columnNames.includes(options.sortBy);
    const hasCreatedAt = columnNames.includes('created_at');
    const hasId = columnNames.includes('id');
    const sortColumn = hasSortBy
      ? options.sortBy!
      : hasCreatedAt
        ? 'created_at'
        : hasId
          ? 'id'
          : columnNames[0];
    const sortDirection = options.sortDir === 'asc' ? 'ASC' : 'DESC';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${tableName} ${whereSql}`,
      whereValues,
    );
    const total = parseInt(countResult.rows[0]?.count ?? 0, 10);

    const recordsResult = await pool.query(
      `SELECT *
       FROM ${tableName}
       ${whereSql}
       ORDER BY ${sortColumn} ${sortDirection}
       LIMIT $${whereValues.length + 1}
       OFFSET $${whereValues.length + 2}`,
      [...whereValues, safeLimit, safeOffset],
    );

    return {
      table: tableName,
      total,
      limit: safeLimit,
      offset: safeOffset,
      displayColumns,
      records: recordsResult.rows,
    };
  }

  /**
   * Insert a record into a table.
   * #1 – Column names in `data` are validated against information_schema before being
   * interpolated into SQL, preventing SQL injection via crafted column names.
   */
  async createTableRecord(tableName: string, data: any) {
    this.validateTableName(tableName);
    const pool = this.databaseService.getPool();

    const allowedColumns = await this.getAllowedColumns(tableName);
    const columns = Object.keys(data).filter((c) => allowedColumns.has(c));

    if (columns.length === 0) {
      throw new BadRequestException('No valid column names provided');
    }

    const values = columns.map((c) => data[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnList = columns.join(', ');

    try {
      const result = await pool.query(
        `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders}) RETURNING *`,
        values,
      );
      return { success: true, record: result.rows[0] };
    } catch (error: any) {
      throw new BadRequestException(`Failed to insert record: ${error.message}`);
    }
  }

  /**
   * Update a record in a table.
   * #1 – Column names in `data` are validated against information_schema before being
   * interpolated into SQL, preventing SQL injection via crafted column names.
   */
  async updateTableRecord(tableName: string, recordId: string, data: any) {
    this.validateTableName(tableName);
    const pool = this.databaseService.getPool();

    const allowedColumns = await this.getAllowedColumns(tableName);
    const keys = Object.keys(data).filter((k) => allowedColumns.has(k));

    if (keys.length === 0) {
      throw new BadRequestException('No valid column names provided');
    }

    const values = keys.map((k) => data[k]);
    const updates = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    values.push(recordId);

    try {
      const result = await pool.query(
        `UPDATE ${tableName} SET ${updates} WHERE id = $${keys.length + 1} RETURNING *`,
        values,
      );
      if (!result.rows[0]) {
        throw new NotFoundException('Record not found');
      }
      return { success: true, record: result.rows[0] };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Failed to update record: ${error.message}`);
    }
  }

  async deleteTableRecord(tableName: string, recordId: string) {
    this.validateTableName(tableName);
    const pool = this.databaseService.getPool();

    try {
      const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING id`, [recordId]);
      if (!result.rows[0]) {
        throw new NotFoundException('Record not found');
      }
      return { success: true, deletedId: recordId };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Failed to delete record: ${error.message}`);
    }
  }

  /**
   * Execute a read-only SELECT query.
   * #2 – The query runs inside a READ ONLY transaction so that even if a dangerous
   * PG function (pg_read_file, dblink, etc.) attempts a write side-effect, the
   * transaction will reject it.
   */
  async executeQuery(query: string, params?: any[]) {
    // Security: only allow SELECT statements
    if (!/^\s*SELECT\s+/i.test(query.trim())) {
      throw new BadRequestException('Only SELECT queries are allowed');
    }

    const pool = this.databaseService.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const result = await client.query(query, params);
      await client.query('COMMIT');
      return {
        success: true,
        rowCount: result.rows.length,
        rows: result.rows,
      };
    } catch (error: any) {
      await client.query('ROLLBACK').catch(() => {});
      throw new BadRequestException(`Query failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
}
