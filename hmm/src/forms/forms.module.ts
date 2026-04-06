import { Module } from '@nestjs/common';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService], // important for responses module
})
export class FormsModule {}