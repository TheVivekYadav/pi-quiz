import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';

/**
 * Guard that verifies the request carries a valid user Bearer token.
 * On success it attaches `req.authUser` so downstream handlers can read userId/role
 * without making a second DB call.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    const token = authHeader?.split(' ')?.[1] ?? null;

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const auth = await this.authService.verifyToken(token);
    if (!auth) {
      throw new UnauthorizedException('Invalid authorization token');
    }

    request.authUser = auth;
    return true;
  }
}
