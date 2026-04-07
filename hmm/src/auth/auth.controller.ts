import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    Param,
    Post,
    Query,
    Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, AuthToken } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body()
    body: {
      rollNumber: string;
      name?: string;
      email?: string;
      branch?: string;
      year?: number;
      deviceName?: string;
      deviceId?: string;
      platform?: string;
    },
    @Req() req: Request,
  ): Promise<AuthToken> {
    if (!body.rollNumber) {
      throw new BadRequestException('Roll number is required');
    }

    return this.authService.login(
      body.rollNumber,
      body.name,
      body.email,
      body.branch,
      body.year,
      body.deviceName,
      body.deviceId,
      body.platform,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('logout')
  async logout(
    @Headers('Authorization') authHeader: string,
  ): Promise<{ success: boolean }> {
    const token = this.extractToken(authHeader);
    if (token) {
      await this.authService.logout(token);
    }
    return { success: true };
  }

  @Get('me')
  async getMe(@Headers('Authorization') authHeader: string): Promise<{
    authenticated: boolean;
    userId?: number;
    rollNumber?: string;
    role?: string;
    sessionId?: string;
    name?: string;
    email?: string;
    branch?: string;
    year?: number;
  }> {
    const token = this.extractToken(authHeader);
    if (!token) {
      return { authenticated: false };
    }

    const authToken = await this.authService.verifyToken(token);
    if (!authToken) {
      return { authenticated: false };
    }

    // Also fetch full user record for profile fields
    const user = await this.authService.getUserProfile(authToken.userId);

    return {
      authenticated: true,
      userId: authToken.userId,
      rollNumber: authToken.rollNumber,
      role: authToken.role,
      sessionId: authToken.sessionId,
      name: user?.name ?? undefined,
      email: user?.email ?? undefined,
      branch: user?.branch ?? undefined,
      year: user?.year ?? undefined,
    };
  }

  @Get('sessions')
  async listSessions(@Headers('Authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new BadRequestException('Missing authorization token');
    }

    const auth = await this.authService.verifyToken(token);
    if (!auth) {
      throw new BadRequestException('Invalid authorization token');
    }

    return {
      maxActiveDevices: Number(process.env.MAX_ACTIVE_DEVICES ?? 2),
      sessions: await this.authService.listSessions(auth.userId, token),
    };
  }

  @Post('sessions/:sessionId/block')
  async blockSession(
    @Param('sessionId') sessionId: string,
    @Headers('Authorization') authHeader: string,
    @Body() body: { reason?: string },
  ) {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new BadRequestException('Missing authorization token');
    }
    const auth = await this.authService.verifyToken(token);
    if (!auth) {
      throw new BadRequestException('Invalid authorization token');
    }
    return this.authService.blockSession(auth.userId, sessionId, body?.reason);
  }

  @Post('sessions/:sessionId/unblock')
  async unblockSession(
    @Param('sessionId') sessionId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new BadRequestException('Missing authorization token');
    }
    const auth = await this.authService.verifyToken(token);
    if (!auth) {
      throw new BadRequestException('Invalid authorization token');
    }
    return this.authService.unblockSession(auth.userId, sessionId);
  }

  @Get('logs')
  async getLogs(
    @Headers('Authorization') authHeader: string,
    @Query('limit') limit?: string,
    @Query('rollNumber') rollNumber?: string,
  ) {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new BadRequestException('Missing authorization token');
    }
    const auth = await this.authService.verifyToken(token);
    if (!auth) {
      throw new BadRequestException('Invalid authorization token');
    }
    const parsedLimit = Number(limit ?? 100);
    return this.authService.getLogs(auth.userId, auth.role, parsedLimit, rollNumber);
  }

  private extractToken(authHeader: string): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
  }
}
