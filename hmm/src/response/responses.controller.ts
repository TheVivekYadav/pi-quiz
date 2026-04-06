// responses/responses.controller.ts

import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ResponsesService } from './responses.service';

@Controller('responses')
export class ResponsesController {
  constructor(private readonly responsesService: ResponsesService) {}

  @Post()
  create(@Body() body: any) {
    return this.responsesService.create(body);
  }

  @Get()
  findAll() {
    return this.responsesService.findAll();
  }

  @Get(':formId')
  findByForm(@Param('formId') formId: string) {
    return this.responsesService.findByForm(formId);
  }
}