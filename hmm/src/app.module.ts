import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FormsModule } from './forms/forms.module';
import { QuizModule } from './quiz/quiz.module';
import { ResponsesModule } from './response/responses.module';

@Module({
  imports: [DatabaseModule, AuthModule, FormsModule, ResponsesModule, QuizModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
