import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class ErrorLogsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getApiErrorLogs(limit = 50, includeResolved = false) {
    const pool = this.databaseService.getPool();
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));

    const result = await pool.query(
      `SELECT id, method, path, status_code, message, details, resolved, resolved_at, created_at
       FROM api_error_logs
       WHERE ($2::boolean = TRUE OR resolved = FALSE)
       ORDER BY created_at DESC
       LIMIT $1`,
      [safeLimit, includeResolved],
    );

    return result.rows.map((row: any) => ({
      id: Number(row.id),
      method: row.method,
      path: row.path,
      statusCode: Number(row.status_code),
      message: row.message,
      details: row.details ?? {},
      resolved: !!row.resolved,
      resolvedAtIso: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
      createdAtIso: new Date(row.created_at).toISOString(),
    }));
  }

  async resolveApiErrorLog(logId: number, adminUserId: number): Promise<{ success: boolean }> {
    const pool = this.databaseService.getPool();
    const result = await pool.query(
      `UPDATE api_error_logs
       SET resolved = TRUE,
           resolved_at = COALESCE(resolved_at, NOW()),
           resolved_by = COALESCE(resolved_by, $2)
       WHERE id = $1
       RETURNING id`,
      [logId, adminUserId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Error log not found');
    }

    return { success: true };
  }
}
