import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { FormsModule } from './forms/forms.module';
import { QuizModule } from './quiz/quiz.module';
import { ResponsesModule } from './response/responses.moudle';

@Module({
  imports: [DatabaseModule, FormsModule, ResponsesModule, QuizModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
