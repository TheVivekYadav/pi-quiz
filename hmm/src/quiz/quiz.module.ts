import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { QuizController } from './quiz.controller.js';
import { QuizService } from './quiz.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}
