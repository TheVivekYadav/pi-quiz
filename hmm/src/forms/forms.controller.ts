// forms/forms.controller.ts

import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly authService: AuthService,
  ) {}

  /** Extract Bearer token from Authorization header. */
  private extractToken(authHeader: string): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
  }

  /** Verify token and require admin role. Returns userId. */
  private async requireAdmin(authHeader: string): Promise<number> {
    const token = this.extractToken(authHeader);
    if (!token) throw new BadRequestException('Missing authorization token');
    const isAdmin = await this.authService.isAdmin(token);
    if (!isAdmin) throw new ForbiddenException('Admin access required');
    const userId = await this.authService.getUserId(token);
    return userId!;
  }

  /** POST /forms — admin only */
  @Post()
  async create(
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.formsService.create(body);
  }

  /** GET /forms — admin only */
  @Get()
  async findAll(@Headers('Authorization') authHeader: string) {
    await this.requireAdmin(authHeader);
    return this.formsService.findAll();
  }

  /** GET /forms/:id — public (backs enrollment form display) */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }
}