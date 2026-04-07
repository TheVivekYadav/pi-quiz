import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    Post
} from '@nestjs/common';
import { AuthService, AuthToken } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { rollNumber: string; name?: string; email?: string },
  ): Promise<AuthToken> {
    if (!body.rollNumber) {
      throw new BadRequestException('Roll number is required');
    }

    return this.authService.login(body.rollNumber, body.name, body.email);
  }

  @Post('logout')
  logout(@Headers('Authorization') authHeader: string): { success: boolean } {
    const token = this.extractToken(authHeader);
    if (token) {
      this.authService.logout(token);
    }
    return { success: true };
  }

  @Get('me')
  async getMe(@Headers('Authorization') authHeader: string): Promise<{
    authenticated: boolean;
    userId?: number;
    rollNumber?: string;
    role?: string;
  }> {
    const token = this.extractToken(authHeader);
    if (!token) {
      return { authenticated: false };
    }

    const authToken = this.authService.verifyToken(token);
    if (!authToken) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      userId: authToken.userId,
      rollNumber: authToken.rollNumber,
      role: authToken.role,
    };
  }

  private extractToken(authHeader: string): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
  }
}
