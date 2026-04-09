import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
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

  @Get('home')
  async getHome(@Headers('Authorization') authHeader: string) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.getHome(userId);
  }

  @Get('reports/overview')
  async getReportsOverview(@Headers('Authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    if (!token) throw new BadRequestException('Missing authorization token');
    const userId = await this.authService.getUserId(token);
    if (!userId) throw new BadRequestException('Invalid authorization token');
    const isAdmin = await this.authService.isAdmin(token);
    return this.quizService.getReportsOverview(userId, isAdmin ? 'admin' : 'user');
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
    });
  }

  @Get(':quizId/questions')
  async listQuestions(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.getQuizQuestions(quizId);
  }

  @Delete(':quizId/questions/:questionId')
  async deleteQuestion(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.deleteQuestion(quizId, questionId);
  }

  // Admin: get all user responses for a quiz
  @Get(':quizId/admin-responses')
  async getAdminResponses(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.adminGetQuizResponses(quizId);
  }

  // User: get their own responses for a quiz
  @Get(':quizId/my-responses')
  async getMyResponses(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.getUserQuizResponses(quizId, userId);
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

    return this.quizService.addQuestion(quizId, {
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
    return this.quizService.deleteQuiz(quizId);
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

    return this.quizService.setEnrollmentForm(quizId, fields);
  }

  @Get(':quizId/enrollment-form')
  async getEnrollmentForm(@Param('quizId') quizId: string) {
    return this.quizService.getEnrollmentForm(quizId);
  }

  // ─── User endpoints ─────────────────────────────────────────────────────

  @Post(':quizId/enroll')
  async enrollQuiz(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.enrollUser(userId, quizId, body?.formAnswers);
  }

  @Get(':quizId/lobby')
  async getLobby(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.getLobby(quizId, userId);
  }

  @Get(':quizId/leaderboard')
  async getLeaderboard(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.getLeaderboard(quizId, userId);
  }

  @Get(':quizId/question/:index')
  async getQuestion(
    @Param('quizId') quizId: string,
    @Param('index', ParseIntPipe) index: number,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.getQuestion(quizId, userId, index);
  }

  @Post(':quizId/submit')
  async submitQuiz(
    @Param('quizId') quizId: string,
    @Body() body: any,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.submitQuiz(quizId, userId, body.answers || {}, body.startedAt);
  }

  @Get(':quizId')
  getQuizDetail(@Param('quizId') quizId: string) {
    return this.quizService.getQuizDetail(quizId);
  }

  // Admin: start quiz immediately
  @Post(':quizId/start')
  async startQuiz(@Param('quizId') quizId: string, @Headers('Authorization') authHeader: string) {
    await this.requireAdmin(authHeader);
    return this.quizService.startQuiz(quizId);
  }

  // Admin: declare winners for a quiz
  @Post(':quizId/declare-winners')
  async declareWinners(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const adminId = await this.requireAdmin(authHeader);
    return this.quizService.adminDeclareWinners(quizId, adminId);
  }

  // Any authenticated user: get declared winners
  @Get(':quizId/winners')
  async getWinners(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.getUserId(authHeader);
    return this.quizService.getWinners(quizId);
  }

  // Admin: full quiz report
  @Get(':quizId/report')
  async getQuizReport(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    await this.requireAdmin(authHeader);
    return this.quizService.adminGetQuizReport(quizId);
  }
}
