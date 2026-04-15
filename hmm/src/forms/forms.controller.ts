// forms/forms.controller.ts

import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/admin.guard.js';
import { FormsService } from './forms.service.js';

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  /** POST /forms — admin only */
  @UseGuards(AdminGuard)
  @Post()
  async create(@Body() body: any, @Req() _req: any) {
    return this.formsService.create(body);
  }

  /** GET /forms — admin only */
  @UseGuards(AdminGuard)
  @Get()
  async findAll() {
    return this.formsService.findAll();
  }

  /** GET /forms/:id — public (backs enrollment form display) */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }
}