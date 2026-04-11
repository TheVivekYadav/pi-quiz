import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, Param, ParseIntPipe, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AuthService } from '../auth/auth.service.js';
import { QuizService } from './quiz.service.js';

@Controller('quiz')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly authService: AuthService,
  ) {}

  private async getUserId(authHeader: string): Promise<number> {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new BadRequestException('Missing authorization token');
    }
    const userId = await this.authService.getUserId(token);
    if (!userId) {
      throw new BadRequestException('Invalid authorization token');
    }
    return userId;
  }

  private async requireAdmin(authHeader: string): Promise<number> {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new BadRequestException('Missing authorization token');
    }
    const isAdmin = await this.authService.isAdmin(token);
    if (!isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    const userId = await this.authService.getUserId(token);
    return userId!;
  }

  private extractToken(authHeader: string): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
  }

  private getPublicBaseUrl(req: any): string {
    const configured = process.env.PUBLIC_BASE_URL?.trim();
    if (configured) return configured.replace(/\/$/, '');

    const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? req.get?.('host') ?? '').split(',')[0].trim();
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  private getPublicApiBaseUrl(req: any): string {
    const configured = process.env.PUBLIC_API_BASE_URL?.trim();
    if (configured) return configured.replace(/\/$/, '');
    return `${this.getPublicBaseUrl(req)}/api`;
  }

  private async resolveQuizRef(quizRef: string): Promise<string> {
    return this.quizService.resolveQuizRef(quizRef);
  }

  @Get('home')
  async getHome(@Headers('Authorization') authHeader: string) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.getHome(userId);
  }

  @Get('reports/overview')
  async getReportsOverview(
    @Headers('Authorization') authHeader: string,
    @Query('range') range?: 'today' | 'week' | 'month' | 'all',
  ) {
    const token = this.extractToken(authHeader);
    if (!token) throw new BadRequestException('Missing authorization token');
    const userId = await this.authService.getUserId(token);
    if (!userId) throw new BadRequestException('Invalid authorization token');
    const isAdmin = await this.authService.isAdmin(token);
    return this.quizService.getReportsOverview(userId, isAdmin ? 'admin' : 'user', range ?? 'all');
  }

  @Get('upcoming')
  async listUpcoming(@Headers('Authorization') authHeader: string) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.listUpcoming(userId);
  }

  // ─── Admin endpoints ────────────────────────────────────────────────────

  @Get('admin/list')
  async listAllQuizzes(@Headers('Authorization') authHeader: string) {
    await this.requireAdmin(authHeader);
    return this.quizService.listAllQuizzes();
  }

  @Post()
  async createQuiz(
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.requireAdmin(authHeader);

    if (!body.title || !body.topic || !body.category || !body.level || !body.durationMinutes || !body.startsAt) {
      throw new BadRequestException('title, topic, category, level, durationMinutes and startsAt are required');
    }

    return this.quizService.createQuiz(userId, {
      title: String(body.title),
      topic: String(body.topic),
      category: String(body.category),
      level: String(body.level),
      durationMinutes: Number(body.durationMinutes),
      startsAt: String(body.startsAt),
      description: body.description ? String(body.description) : undefined,
      expectations: body.expectations ? String(body.expectations) : undefined,
      curatorNote: body.curatorNote ? String(body.curatorNote) : undefined,
      imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
    });
  }

  @Post('banner-upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const uploadDir = join(process.cwd(), 'uploads', 'banners');
        mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const safeExt = extname(file.originalname || '').toLowerCase() || '.jpg';
        cb(null, `${randomUUID()}${safeExt}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const mime = String(file.mimetype ?? '').toLowerCase();
      const ext = extname(file.originalname ?? '').toLowerCase();
      const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
      if (!(mime.startsWith('image/') || imageExts.has(ext))) {
        return cb(new BadRequestException('Only image files are allowed') as any, false);
      }
      cb(null, true);
    },
    limits: { fileSize: 8 * 1024 * 1024 },
  }))
  async uploadBannerImage(
    @UploadedFile() file: Express.Multer.File,
    @Headers('Authorization') authHeader: string,
    @Req() req: any,
  ) {
    await this.requireAdmin(authHeader);

    if (!file) {
      throw new BadRequestException('Banner image file is required');
    }

    return {
      success: true,
      url: `${this.getPublicApiBaseUrl(req)}/uploads/banners/${file.filename}`,
    };
  }

  @Get(':quizId/questions')
  async listQuestions(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getQuizQuestions(resolvedQuizId);
  }

  @Delete(':quizId/questions/:questionId')
  async deleteQuestion(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.deleteQuestion(resolvedQuizId, questionId);
  }

  // Admin: get all user responses for a quiz
  @Get(':quizId/admin-responses')
  async getAdminResponses(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.adminGetQuizResponses(resolvedQuizId);
  }

  // Admin: get all enrollments for a quiz with form data
  @Get(':quizId/admin/enrollments')
  async getAdminEnrollments(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getQuizEnrollments(resolvedQuizId);
  }

  // Admin: remove a single user's enrollment from a quiz
  @Delete(':quizId/admin/enrollments/:userId')
  async removeAdminEnrollment(
    @Param('quizId') quizId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.adminRemoveEnrollment(resolvedQuizId, userId);
  }

  // User: get their own responses for a quiz
  @Get(':quizId/my-responses')
  async getMyResponses(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getUserQuizResponses(resolvedQuizId, userId);
  }

  @Post(':quizId/questions')
  async addQuestion(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);

    if (!body.text || !Array.isArray(body.options) || body.options.length < 2 || !body.correctOptionId) {
      throw new BadRequestException('text, options (array with ≥2 items) and correctOptionId are required');
    }

    // Validate imageUrl must be an https:// URL if provided
    if (body.imageUrl !== undefined && body.imageUrl !== null && body.imageUrl !== '') {
      let validUrl = false;
      try {
        const parsed = new URL(String(body.imageUrl));
        validUrl = parsed.protocol === 'https:';
      } catch {
        validUrl = false;
      }
      if (!validUrl) {
        throw new BadRequestException('imageUrl must be a valid https:// URL');
      }
    }

    const resolvedQuizId = await this.resolveQuizRef(quizId);

    return this.quizService.addQuestion(resolvedQuizId, {
      text: String(body.text),
      imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
      options: body.options,
      correctOptionId: String(body.correctOptionId),
      points: body.points !== undefined ? Number(body.points) : 1,
    });
  }

  @Delete(':quizId')
  async deleteQuiz(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.deleteQuiz(resolvedQuizId);
  }

  @Post(':quizId/enrollment-form')
  async setEnrollmentForm(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);

    const fields = body?.fields;
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new BadRequestException('fields must be a non-empty array');
    }

    // Validate each field
    const VALID_TYPES = ['text', 'email', 'phone', 'number', 'select'];
    for (const f of fields) {
      if (!f.id || !f.label || !VALID_TYPES.includes(f.type)) {
        throw new BadRequestException(
          `Each field must have id, label, and type (one of ${VALID_TYPES.join(', ')})`,
        );
      }
      if (f.type === 'select' && (!Array.isArray(f.options) || f.options.length < 2)) {
        throw new BadRequestException(`Select field "${f.label}" must have at least 2 options`);
      }
    }

    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.setEnrollmentForm(resolvedQuizId, fields);
  }

  @Get(':quizId/enrollment-form')
  async getEnrollmentForm(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getEnrollmentForm(resolvedQuizId);
  }

  // ─── User endpoints ─────────────────────────────────────────────────────

  @Post(':quizId/enroll')
  async enrollQuiz(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.enrollUser(userId, resolvedQuizId, body?.formAnswers);
  }

  @Get(':quizId/lobby')
  async getLobby(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getLobby(resolvedQuizId, userId);
  }

  @Get(':quizId/leaderboard')
  async getLeaderboard(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getLeaderboard(resolvedQuizId, userId);
  }

  @Get(':quizId/question/:index')
  async getQuestion(
    @Param('quizId') quizId: string,
    @Param('index', ParseIntPipe) index: number,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getQuestion(resolvedQuizId, userId, index);
  }

  @Post(':quizId/submit')
  async submitQuiz(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.submitQuiz(resolvedQuizId, userId, body.answers || {}, body.startedAt);
  }

  @Get(':quizId')
  async getQuizDetail(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getQuizDetail(resolvedQuizId);
  }

  // Admin: start quiz immediately
  @Post(':quizId/start')
  async startQuiz(@Param('quizId') quizId: string, @Headers('Authorization') authHeader: string) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.startQuiz(resolvedQuizId);
  }

  // Admin: update quiz schedule (start time and/or duration)
  @Post(':quizId/schedule')
  async updateQuizSchedule(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.updateQuizSchedule(resolvedQuizId, {
      startsAt: body?.startsAt ? String(body.startsAt) : undefined,
      durationMinutes:
        body?.durationMinutes !== undefined && body?.durationMinutes !== null
          ? Number(body.durationMinutes)
          : undefined,
    });
  }

  // Admin: update quiz metadata
  @Post(':quizId/metadata')
  async updateQuizMetadata(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    const payload: any = {};
    if (body?.title !== undefined) payload.title = String(body.title).trim();
    if (body?.description !== undefined) payload.description = String(body.description).trim();
    if (body?.category !== undefined) payload.category = String(body.category).trim();
    if (body?.level !== undefined && ['Beginner', 'Intermediate', 'Expert'].includes(body.level)) {
      payload.level = body.level;
    }
    if (body?.imageUrl !== undefined) payload.imageUrl = String(body.imageUrl).trim();
    if (body?.durationMinutes !== undefined) {
      payload.durationMinutes = Number(body.durationMinutes);
      if (payload.durationMinutes < 1 || payload.durationMinutes > 1440) {
        throw new BadRequestException('durationMinutes must be between 1 and 1440');
      }
    }
    if (body?.enrollmentEnabled !== undefined) {
      if (typeof body.enrollmentEnabled !== 'boolean') {
        throw new BadRequestException('enrollmentEnabled must be boolean');
      }
      payload.enrollmentEnabled = body.enrollmentEnabled;
    }
    if (body?.enrollmentStartsAt !== undefined) {
      payload.enrollmentStartsAt = body.enrollmentStartsAt ? String(body.enrollmentStartsAt) : null;
    }
    return this.quizService.updateQuizMetadata(resolvedQuizId, payload);
  }

  // Admin: set quiz visibility
  @Post(':quizId/visibility')
  async updateQuizVisibility(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    if (typeof body?.visible !== 'boolean') {
      throw new BadRequestException('visible must be boolean');
    }
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.updateQuizVisibility(resolvedQuizId, body.visible);
  }

  // Admin: declare winners for a quiz
  @Post(':quizId/declare-winners')
  async declareWinners(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const adminId = await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.adminDeclareWinners(resolvedQuizId, adminId);
  }

  // Any authenticated user: get declared winners
  @Get(':quizId/winners')
  async getWinners(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.getUserId(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getWinners(resolvedQuizId);
  }

  // Admin: full quiz report
  @Get(':quizId/report')
  async getQuizReport(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.adminGetQuizReport(resolvedQuizId);
  }

  // Admin: recent API error logs
  @Get('admin/error-logs')
  async getApiErrorLogs(
    @Query('limit') limitRaw: string | undefined,
    @Query('includeResolved') includeResolvedRaw: string | undefined,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    const limit = limitRaw !== undefined ? Number(limitRaw) : 50;
    const includeResolved = includeResolvedRaw === 'true';
    return this.quizService.getApiErrorLogs(limit, includeResolved);
  }

  @Post('admin/error-logs/:logId/resolve')
  async resolveApiErrorLog(
    @Param('logId', ParseIntPipe) logId: number,
    @Headers('Authorization') authHeader: string,
  ) {
    const adminId = await this.requireAdmin(authHeader);
    return this.quizService.resolveApiErrorLog(logId, adminId);
  }

  // ─── Database CRUD Management ──────────────────────────────────────────

  // Admin: list all tables
  @Get('admin/database/tables')
  async listDatabaseTables(@Headers('Authorization') authHeader: string) {
    await this.requireAdmin(authHeader);
    return this.quizService.getDatabaseTables();
  }

  // Admin: get table schema
  @Get('admin/database/:tableName/schema')
  async getTableSchema(
    @Param('tableName') tableName: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.getTableSchema(tableName);
  }

  // Admin: get table records with pagination
  @Get('admin/database/:tableName/records')
  async getTableRecords(
    @Param('tableName') tableName: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('nullOnly') nullOnly?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Headers('Authorization') authHeader?: string,
  ) {
    await this.requireAdmin(authHeader || '');
    return this.quizService.getTableRecords(tableName, {
      limit: limit || 50,
      offset: offset || 0,
      search: search?.trim() || undefined,
      role: role?.trim() || undefined,
      nullOnly: nullOnly === 'true',
      sortBy: sortBy?.trim() || undefined,
      sortDir: sortDir === 'asc' ? 'asc' : 'desc',
    });
  }

  // Admin: insert record
  @Post('admin/database/:tableName/records')
  async createTableRecord(
    @Param('tableName') tableName: string,
    @Body() data: any,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.createTableRecord(tableName, data);
  }

  // Admin: update record
  @Post('admin/database/:tableName/records/:recordId')
  async updateTableRecord(
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
    @Body() data: any,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.updateTableRecord(tableName, recordId, data);
  }

  // Admin: delete record
  @Delete('admin/database/:tableName/records/:recordId')
  async deleteTableRecord(
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.deleteTableRecord(tableName, recordId);
  }

  // Admin: execute raw query (read-only)
  @Post('admin/database/query')
  async executeQuery(
    @Body() payload: { query: string; params?: any[] },
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.executeQuery(payload.query, payload.params);
  }
}
