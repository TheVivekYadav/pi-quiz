import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service.js';
import { UsersService } from './users.service.js';

export interface AuthToken {
  userId: number;
  rollNumber: string;
  role: 'admin' | 'user';
  token: string;
  sessionId: string;
}

export interface SessionInfo {
  sessionId: string;
  deviceName: string | null;
  platform: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  isBlocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  revokedAt: string | null;
  current: boolean;
}

@Injectable()
export class AuthService {
  private readonly maxActiveDevices = Number(process.env.MAX_ACTIVE_DEVICES ?? 2);

  constructor(
    private usersService: UsersService,
    private databaseService: DatabaseService,
  ) {}

  private async logEvent(
    eventType: string,
    details: Record<string, any>,
    userId?: number,
    sessionId?: string,
  ): Promise<void> {
    await this.databaseService.getPool().query(
      `INSERT INTO auth_logs (user_id, session_id, event_type, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId ?? null, sessionId ?? null, eventType, JSON.stringify(details ?? {})],
    );
  }

  async login(
    rollNumber: string,
    name?: string,
    email?: string,
    branch?: string,
    year?: number,
    deviceName?: string,
    deviceId?: string,
    platform?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthToken> {
    const normalizedRoll = rollNumber.trim().toUpperCase();

    // Check if user exists
    let user = await this.usersService.getUserByRollNumber(normalizedRoll);

    // If not exists, create new user (first-time visitor)
    if (!user) {
      user = await this.usersService.createUser(normalizedRoll, name, email, branch, year);
    } else {
      const updates: Record<string, any> = {};
      if (name && !user.name) updates.name = name;
      if (email && !user.email) updates.email = email;
      if (branch && !user.branch) updates.branch = branch;
      if (year && !user.year) updates.year = year;
      if (Object.keys(updates).length > 0) {
        user = await this.usersService.updateUser(user.id, updates);
      }
    }

    const activeResult = await this.databaseService.getPool().query(
      `SELECT id FROM user_sessions
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND is_blocked = FALSE`,
      [user.id],
    );

    if (activeResult.rows.length >= this.maxActiveDevices) {
      await this.logEvent(
        'login_blocked_max_devices',
        {
          rollNumber: normalizedRoll,
          maxActiveDevices: this.maxActiveDevices,
          attemptedDevice: deviceName ?? null,
        },
        user.id,
      );
      throw new BadRequestException(
        `Maximum ${this.maxActiveDevices} active devices reached. Block/logout an old device first.`,
      );
    }

    // Generate token
    const token = randomUUID();
    const sessionId = randomUUID();

    await this.databaseService.getPool().query(
      `INSERT INTO user_sessions (
        id, user_id, token, device_name, device_id, platform, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId,
        user.id,
        token,
        deviceName ?? null,
        deviceId ?? null,
        platform ?? null,
        ipAddress ?? null,
        userAgent ?? null,
      ],
    );

    const authToken: AuthToken = {
      userId: user.id,
      rollNumber: user.roll_number,
      role: user.role,
      token,
      sessionId,
    };

    await this.logEvent(
      'login_success',
      {
        rollNumber: user.roll_number,
        role: user.role,
        deviceName: deviceName ?? null,
        platform: platform ?? null,
      },
      user.id,
      sessionId,
    );

    return authToken;
  }

  async verifyToken(token: string): Promise<AuthToken | null> {
    const result = await this.databaseService.getPool().query(
      `SELECT s.id as session_id, s.user_id, u.roll_number, u.role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1
         AND s.revoked_at IS NULL
         AND s.is_blocked = FALSE
       LIMIT 1`,
      [token],
    );

    const row = result.rows[0];
    if (!row) return null;

    await this.databaseService
      .getPool()
      .query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE id = $1`, [row.session_id]);

    return {
      userId: row.user_id,
      rollNumber: row.roll_number,
      role: row.role,
      token,
      sessionId: row.session_id,
    };
  }

  async logout(token: string): Promise<void> {
    const verify = await this.verifyToken(token);
    if (!verify) return;

    await this.databaseService
      .getPool()
      .query(`UPDATE user_sessions SET revoked_at = NOW() WHERE token = $1`, [token]);

    await this.logEvent(
      'logout',
      { rollNumber: verify.rollNumber },
      verify.userId,
      verify.sessionId,
    );
  }

  async isAdmin(token: string): Promise<boolean> {
    const authToken = await this.verifyToken(token);
    return authToken?.role === 'admin' || false;
  }

  async getUserId(token: string): Promise<number | null> {
    const authToken = await this.verifyToken(token);
    return authToken?.userId || null;
  }

  async listSessions(userId: number, currentToken?: string): Promise<SessionInfo[]> {
    const current = currentToken ? await this.verifyToken(currentToken) : null;

    const result = await this.databaseService.getPool().query(
      `SELECT id, device_name, platform, ip_address, user_agent, created_at,
              last_seen_at, is_blocked, blocked_at, blocked_reason, revoked_at
       FROM user_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row: any) => ({
      sessionId: row.id,
      deviceName: row.device_name,
      platform: row.platform,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      isBlocked: row.is_blocked,
      blockedAt: row.blocked_at,
      blockedReason: row.blocked_reason,
      revokedAt: row.revoked_at,
      current: current?.sessionId === row.id,
    }));
  }

  async blockSession(
    actorUserId: number,
    sessionId: string,
    reason?: string,
  ): Promise<{ success: boolean }> {
    const result = await this.databaseService.getPool().query(
      `UPDATE user_sessions
       SET is_blocked = TRUE,
           blocked_reason = $3,
           blocked_at = NOW(),
           revoked_at = COALESCE(revoked_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, actorUserId, reason ?? 'Blocked by user'],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Session not found for this user');
    }

    await this.logEvent(
      'session_blocked',
      { sessionId, reason: reason ?? 'Blocked by user' },
      actorUserId,
      sessionId,
    );
    return { success: true };
  }

  async unblockSession(actorUserId: number, sessionId: string): Promise<{ success: boolean }> {
    const result = await this.databaseService.getPool().query(
      `UPDATE user_sessions
       SET is_blocked = FALSE,
           blocked_reason = NULL,
           blocked_at = NULL,
           revoked_at = NULL
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, actorUserId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Session not found for this user');
    }

    await this.logEvent('session_unblocked', { sessionId }, actorUserId, sessionId);
    return { success: true };
  }

  async getLogs(
    actorUserId: number,
    actorRole: 'admin' | 'user',
    limit = 100,
    targetRollNumber?: string,
  ) {
    let targetUserId = actorUserId;

    if (targetRollNumber && actorRole === 'admin') {
      const target = await this.usersService.getUserByRollNumber(targetRollNumber.toUpperCase());
      if (target) {
        targetUserId = target.id;
      }
    }

    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const result = await this.databaseService.getPool().query(
      `SELECT id, user_id, session_id, event_type, details, created_at
       FROM auth_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [targetUserId, safeLimit],
    );

    return {
      userId: targetUserId,
      count: result.rows.length,
      logs: result.rows,
    };
  }
}
