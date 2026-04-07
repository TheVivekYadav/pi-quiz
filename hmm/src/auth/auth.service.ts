import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersService } from './users.service.js';

export interface AuthToken {
  userId: number;
  rollNumber: string;
  role: 'admin' | 'user';
  token: string;
}

@Injectable()
export class AuthService {
  private tokens: Map<string, AuthToken> = new Map();

  constructor(private usersService: UsersService) {}

  async login(
    rollNumber: string,
    name?: string,
    email?: string,
  ): Promise<AuthToken> {
    // Check if user exists
    let user = await this.usersService.getUserByRollNumber(rollNumber);

    // If not exists, create new user (first-time visitor)
    if (!user) {
      user = await this.usersService.createUser(rollNumber, name, email);
    }

    // Generate token
    const token = randomUUID();
    const authToken: AuthToken = {
      userId: user.id,
      rollNumber: user.roll_number,
      role: user.role,
      token,
    };

    this.tokens.set(token, authToken);
    return authToken;
  }

  verifyToken(token: string): AuthToken | null {
    return this.tokens.get(token) || null;
  }

  logout(token: string): void {
    this.tokens.delete(token);
  }

  isAdmin(token: string): boolean {
    const authToken = this.verifyToken(token);
    return authToken?.role === 'admin' || false;
  }

  getUserId(token: string): number | null {
    const authToken = this.verifyToken(token);
    return authToken?.userId || null;
  }
}
