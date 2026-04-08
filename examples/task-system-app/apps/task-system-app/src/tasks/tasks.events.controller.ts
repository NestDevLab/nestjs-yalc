import { Controller, Get } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TasksDomainEventsService } from './tasks.domain-events.service';

@Controller('tasks-events')
export class TasksEventsController {
  constructor(private readonly service: TasksDomainEventsService) {}

  @Get()
  async emitDemoEvents() {
    const taskId = randomUUID();
    const projectId = randomUUID();

    await this.service.emitTaskCreated(taskId, projectId);
    await this.service.emitTaskStatusChanged(taskId, 'todo');

    return {
      ok: true,
      taskId,
      projectId,
    };
  }
}
