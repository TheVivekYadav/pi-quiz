import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from '../common/admin.guard.js';
import { FormsController } from './forms.controller.js';
import { FormsService } from './forms.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FormsController],
  providers: [FormsService, AdminGuard],
  exports: [FormsService], // important for responses module
})
export class FormsModule {}