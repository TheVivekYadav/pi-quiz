import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from '../common/admin.guard.js';
import { AuthGuard } from '../common/auth.guard.js';
import { DatabaseModule } from '../database/database.module.js';
import { DatabaseCrudService } from './database-crud.service.js';
import { ErrorLogsService } from './error-logs.service.js';
import { QuizAdminService } from './quiz-admin.service.js';
import { QuizController } from './quiz.controller.js';
import { QuizService } from './quiz.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [QuizController],
  providers: [QuizService, QuizAdminService, DatabaseCrudService, ErrorLogsService, AdminGuard, AuthGuard],
})
export class QuizModule {}
