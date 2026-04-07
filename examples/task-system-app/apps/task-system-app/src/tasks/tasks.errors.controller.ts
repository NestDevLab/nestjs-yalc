import { Controller, Get } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';

@Controller('tasks/errors')
export class TasksErrorsController {
  constructor(private readonly events: YalcEventService) {}

  @Get('bad-request')
  badRequest() {
    throw this.events.errorBadRequest('tasks.validation.failed', {
      response: { message: 'Invalid task payload' },
      data: { area: 'tasks' },
    });
  }

  @Get('not-found')
  notFound() {
    throw this.events.errorNotFound('tasks.resource.not-found', {
      response: { message: 'Task not found' },
      data: { area: 'tasks' },
    });
  }
}
