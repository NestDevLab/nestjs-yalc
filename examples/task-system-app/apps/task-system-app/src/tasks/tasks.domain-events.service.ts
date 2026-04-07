import { Injectable } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { AppLoggerFactory } from '@nestjs-yalc/logger/logger.factory';

@Injectable()
export class TasksDomainEventsService {
  private readonly logger = AppLoggerFactory('TaskSystem.Tasks');

  constructor(private readonly events: YalcEventService) {}

  async emitTaskCreated(taskId: string, projectId?: string | null) {
    await this.events.log(['task-system', 'tasks', 'created'], {
      message: 'Task created',
      data: {
        taskId,
        projectId: projectId ?? null,
      },
      event: { await: true },
      eventAliases: ['tasks.created'],
      logger: {
        instance: this.logger,
      },
    });
  }

  async emitTaskStatusChanged(taskId: string, status: string) {
    await this.events.log(['task-system', 'tasks', 'status-changed'], {
      message: 'Task status changed',
      data: {
        taskId,
        status,
      },
      event: { await: true },
      eventAliases: ['tasks.status-changed'],
      logger: {
        instance: this.logger,
      },
    });
  }
}
