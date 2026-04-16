import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ApiErrorLoggingFilter } from './common/api-error-logging.filter';
import { DatabaseModule } from './database/database.module';
import { FormsModule } from './forms/forms.module';
import { QuizModule } from './quiz/quiz.module';
import { ResponsesModule } from './response/responses.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    FormsModule,
    ResponsesModule,
    QuizModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: ApiErrorLoggingFilter },
  ],
})
export class AppModule {}
