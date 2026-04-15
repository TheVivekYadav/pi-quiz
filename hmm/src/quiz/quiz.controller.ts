import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AuthService } from '../auth/auth.service.js';
import { AdminGuard } from '../common/admin.guard.js';
import { AuthGuard } from '../common/auth.guard.js';
import { DatabaseCrudService } from './database-crud.service.js';
import { ErrorLogsService } from './error-logs.service.js';
import { QuizAdminService } from './quiz-admin.service.js';
import { QuizService } from './quiz.service.js';

@Controller('quiz')
export class QuizController {
  private readonly IMAGE_MODES = ['banner', 'poster'] as const;

  constructor(
    private readonly quizService: QuizService,
    private readonly quizAdminService: QuizAdminService,
    private readonly databaseCrudService: DatabaseCrudService,
    private readonly errorLogsService: ErrorLogsService,
    private readonly authService: AuthService,
  ) {}

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

  // ─── User endpoints ──────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Get('home')
  async getHome(@Req() req: any) {
    return this.quizService.getHome(req.authUser.userId);
  }

  @UseGuards(AuthGuard)
  @Get('reports/overview')
  async getReportsOverview(
    @Req() req: any,
    @Query('range') range?: 'today' | 'week' | 'month' | 'all',
  ) {
    const { userId, role } = req.authUser;
    return this.quizService.getReportsOverview(userId, role === 'admin' ? 'admin' : 'user', range ?? 'all');
  }

  @UseGuards(AuthGuard)
  @Get('upcoming')
  async listUpcoming(@Req() req: any) {
    return this.quizService.listUpcoming(req.authUser.userId);
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────

  @UseGuards(AdminGuard)
  @Get('admin/list')
  async listAllQuizzes() {
    return this.quizAdminService.listAllQuizzes();
  }

  @UseGuards(AdminGuard)
  @Post()
  async createQuiz(@Body() body: any, @Req() req: any) {
    if (!body.title || !body.topic || !body.category || !body.level || !body.durationMinutes || !body.startsAt) {
      throw new BadRequestException('title, topic, category, level, durationMinutes and startsAt are required');
    }

    if (body.imageMode !== undefined && !this.IMAGE_MODES.includes(body.imageMode)) {
      throw new BadRequestException(`imageMode must be one of: ${this.IMAGE_MODES.join(', ')}`);
    }
    const imageMode = body.imageMode !== undefined
      ? (String(body.imageMode) as 'banner' | 'poster')
      : undefined;

    return this.quizAdminService.createQuiz(req.authUser.userId, {
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
      imageMode,
    });
  }

  @UseGuards(AdminGuard)
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
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Banner image file is required');
    }

    return {
      success: true,
      url: `${this.getPublicApiBaseUrl(req)}/uploads/banners/${file.filename}`,
    };
  }

  @UseGuards(AdminGuard)
  @Get(':quizId/questions')
  async listQuestions(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.getQuizQuestions(resolvedQuizId);
  }

  @UseGuards(AdminGuard)
  @Delete(':quizId/questions/:questionId')
  async deleteQuestion(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
  ) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.deleteQuestion(resolvedQuizId, questionId);
  }

  @UseGuards(AdminGuard)
  @Get(':quizId/admin-responses')
  async getAdminResponses(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.adminGetQuizResponses(resolvedQuizId);
  }

  @UseGuards(AdminGuard)
  @Get(':quizId/admin/enrollments')
  async getAdminEnrollments(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.getQuizEnrollments(resolvedQuizId);
  }

  @UseGuards(AdminGuard)
  @Delete(':quizId/admin/enrollments/:userId')
  async removeAdminEnrollment(
    @Param('quizId') quizId: string,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.adminRemoveEnrollment(resolvedQuizId, userId);
  }

  @UseGuards(AuthGuard)
  @Get(':quizId/my-responses')
  async getMyResponses(@Param('quizId') quizId: string, @Req() req: any) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getUserQuizResponses(resolvedQuizId, req.authUser.userId);
  }

  @UseGuards(AdminGuard)
  @Post(':quizId/questions')
  async addQuestion(@Param('quizId') quizId: string, @Body() body: any) {
    if (!body.text || !Array.isArray(body.options) || body.options.length < 2 || !body.correctOptionId) {
      throw new BadRequestException('text, options (array with ≥2 items) and correctOptionId are required');
    }

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
    return this.quizAdminService.addQuestion(resolvedQuizId, {
      text: String(body.text),
      imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
      options: body.options,
      correctOptionId: String(body.correctOptionId),
      points: body.points !== undefined ? Number(body.points) : 1,
    });
  }

  @UseGuards(AdminGuard)
  @Delete(':quizId')
  async deleteQuiz(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.deleteQuiz(resolvedQuizId);
  }

  @UseGuards(AdminGuard)
  @Post(':quizId/enrollment-form')
  async setEnrollmentForm(@Param('quizId') quizId: string, @Body() body: any) {
    const fields = body?.fields;
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new BadRequestException('fields must be a non-empty array');
    }

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
    return this.quizAdminService.setEnrollmentForm(resolvedQuizId, fields);
  }

  @Get(':quizId/enrollment-form')
  async getEnrollmentForm(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getEnrollmentForm(resolvedQuizId);
  }

  @UseGuards(AuthGuard)
  @Post(':quizId/enroll')
  async enrollQuiz(@Param('quizId') quizId: string, @Body() body: any, @Req() req: any) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.enrollUser(req.authUser.userId, resolvedQuizId, body?.formAnswers);
  }

  @UseGuards(AuthGuard)
  @Get(':quizId/lobby')
  async getLobby(@Param('quizId') quizId: string, @Req() req: any) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getLobby(resolvedQuizId, req.authUser.userId);
  }

  @UseGuards(AuthGuard)
  @Get(':quizId/leaderboard')
  async getLeaderboard(@Param('quizId') quizId: string, @Req() req: any) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getLeaderboard(resolvedQuizId, req.authUser.userId);
  }

  @UseGuards(AuthGuard)
  @Get(':quizId/question/:index')
  async getQuestion(
    @Param('quizId') quizId: string,
    @Param('index', ParseIntPipe) index: number,
    @Req() req: any,
  ) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getQuestion(resolvedQuizId, req.authUser.userId, index);
  }

  @UseGuards(AuthGuard)
  @Post(':quizId/submit')
  async submitQuiz(@Param('quizId') quizId: string, @Body() body: any, @Req() req: any) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.submitQuiz(resolvedQuizId, req.authUser.userId, body.answers || {}, body.startedAt);
  }

  /**
   * Public quiz detail endpoint.
   * #7 – Passes isAdmin flag so the service can hide invisible quizzes from non-admins.
   */
  @Get(':quizId')
  async getQuizDetail(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader?: string,
  ) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    // Optional auth: check if the caller is an admin without requiring a token
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const auth = token ? await this.authService.verifyToken(token) : null;
    const isAdmin = auth?.role === 'admin';
    return this.quizService.getQuizDetail(resolvedQuizId, isAdmin);
  }

  @UseGuards(AdminGuard)
  @Post(':quizId/start')
  async startQuiz(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.startQuiz(resolvedQuizId);
  }

  @UseGuards(AdminGuard)
  @Post(':quizId/schedule')
  async updateQuizSchedule(@Param('quizId') quizId: string, @Body() body: any) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.updateQuizSchedule(resolvedQuizId, {
      startsAt: body?.startsAt ? String(body.startsAt) : undefined,
      durationMinutes:
        body?.durationMinutes !== undefined && body?.durationMinutes !== null
          ? Number(body.durationMinutes)
          : undefined,
    });
  }

  @UseGuards(AdminGuard)
  @Post(':quizId/metadata')
  async updateQuizMetadata(@Param('quizId') quizId: string, @Body() body: any) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    const payload: any = {};
    if (body?.title !== undefined) payload.title = String(body.title).trim();
    if (body?.description !== undefined) payload.description = String(body.description).trim();
    if (body?.category !== undefined) payload.category = String(body.category).trim();
    if (body?.level !== undefined && ['Beginner', 'Intermediate', 'Expert'].includes(body.level)) {
      payload.level = body.level;
    }
    if (body?.imageUrl !== undefined) payload.imageUrl = String(body.imageUrl).trim();
    if (body?.imageMode !== undefined) {
      const mode = String(body.imageMode).trim();
      if (!this.IMAGE_MODES.includes(mode as any)) {
        throw new BadRequestException(`imageMode must be one of: ${this.IMAGE_MODES.join(', ')}`);
      }
      payload.imageMode = mode;
    }
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
    return this.quizAdminService.updateQuizMetadata(resolvedQuizId, payload);
  }

  @UseGuards(AdminGuard)
  @Post(':quizId/visibility')
  async updateQuizVisibility(@Param('quizId') quizId: string, @Body() body: any) {
    if (typeof body?.visible !== 'boolean') {
      throw new BadRequestException('visible must be boolean');
    }
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.updateQuizVisibility(resolvedQuizId, body.visible);
  }

  @UseGuards(AdminGuard)
  @Post(':quizId/declare-winners')
  async declareWinners(@Param('quizId') quizId: string, @Req() req: any) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.adminDeclareWinners(resolvedQuizId, req.authUser.userId);
  }

  @UseGuards(AuthGuard)
  @Get(':quizId/winners')
  async getWinners(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizService.getWinners(resolvedQuizId);
  }

  @UseGuards(AdminGuard)
  @Get(':quizId/report')
  async getQuizReport(@Param('quizId') quizId: string) {
    const resolvedQuizId = await this.resolveQuizRef(quizId);
    return this.quizAdminService.adminGetQuizReport(resolvedQuizId);
  }

  // ─── Admin: API error logs ───────────────────────────────────────────────

  @UseGuards(AdminGuard)
  @Get('admin/error-logs')
  async getApiErrorLogs(
    @Query('limit') limitRaw: string | undefined,
    @Query('includeResolved') includeResolvedRaw: string | undefined,
  ) {
    const limit = limitRaw !== undefined ? Number(limitRaw) : 50;
    const includeResolved = includeResolvedRaw === 'true';
    return this.errorLogsService.getApiErrorLogs(limit, includeResolved);
  }

  @UseGuards(AdminGuard)
  @Post('admin/error-logs/:logId/resolve')
  async resolveApiErrorLog(@Param('logId', ParseIntPipe) logId: number, @Req() req: any) {
    return this.errorLogsService.resolveApiErrorLog(logId, req.authUser.userId);
  }

  // ─── Admin: Database CRUD management ─────────────────────────────────────

  @UseGuards(AdminGuard)
  @Get('admin/database/tables')
  async listDatabaseTables() {
    return this.databaseCrudService.getDatabaseTables();
  }

  @UseGuards(AdminGuard)
  @Get('admin/database/:tableName/schema')
  async getTableSchema(@Param('tableName') tableName: string) {
    return this.databaseCrudService.getTableSchema(tableName);
  }

  @UseGuards(AdminGuard)
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
  ) {
    return this.databaseCrudService.getTableRecords(tableName, {
      limit: limit || 50,
      offset: offset || 0,
      search: search?.trim() || undefined,
      role: role?.trim() || undefined,
      nullOnly: nullOnly === 'true',
      sortBy: sortBy?.trim() || undefined,
      sortDir: sortDir === 'asc' ? 'asc' : 'desc',
    });
  }

  @UseGuards(AdminGuard)
  @Post('admin/database/:tableName/records')
  async createTableRecord(@Param('tableName') tableName: string, @Body() data: any) {
    return this.databaseCrudService.createTableRecord(tableName, data);
  }

  @UseGuards(AdminGuard)
  @Post('admin/database/:tableName/records/:recordId')
  async updateTableRecord(
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
    @Body() data: any,
  ) {
    return this.databaseCrudService.updateTableRecord(tableName, recordId, data);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/database/:tableName/records/:recordId')
  async deleteTableRecord(
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
  ) {
    return this.databaseCrudService.deleteTableRecord(tableName, recordId);
  }

  @UseGuards(AdminGuard)
  @Post('admin/database/query')
  async executeQuery(@Body() payload: { query: string; params?: any[] }) {
    return this.databaseCrudService.executeQuery(payload.query, payload.params);
  }
}
