import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { QuizService } from './quiz.service.js';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('home')
  getHome() {
    return this.quizService.getHome();
  }

  @Get('reports/overview')
  getReportsOverview() {
    return this.quizService.getReportsOverview();
  }

  @Get('upcoming')
  listUpcoming() {
    return this.quizService.listUpcoming();
  }

  @Get(':quizId/lobby')
  getLobby(@Param('quizId') quizId: string) {
    return this.quizService.getLobby(quizId);
  }

  @Get(':quizId/leaderboard')
  getLeaderboard(@Param('quizId') quizId: string) {
    return this.quizService.getLeaderboard(quizId);
  }

  @Get(':quizId/question/:index')
  getQuestion(
    @Param('quizId') quizId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.quizService.getQuestion(quizId, index);
  }

  @Post(':quizId/submit')
  submitQuiz(@Param('quizId') quizId: string, @Body() body: any) {
    return this.quizService.submitQuiz(quizId, body);
  }

  @Get(':quizId')
  getQuizDetail(@Param('quizId') quizId: string) {
    return this.quizService.getQuizDetail(quizId);
  }
}
