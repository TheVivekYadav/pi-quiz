import { BadRequestException, Body, Controller, Get, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
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
    const userId = await this.getUserId(authHeader);
    return this.quizService.getReportsOverview(userId);
  }

  @Get('upcoming')
  async listUpcoming(@Headers('Authorization') authHeader: string) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.listUpcoming(userId);
  }

  @Post(':quizId/enroll')
  async enrollQuiz(
    @Param('quizId') quizId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const userId = await this.getUserId(authHeader);
    return this.quizService.enrollUser(userId, quizId);
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
    return this.quizService.submitQuiz(quizId, userId, body.answers || {});
  }

  @Get(':quizId')
  getQuizDetail(@Param('quizId') quizId: string) {
    return this.quizService.getQuizDetail(quizId);
  }
}
