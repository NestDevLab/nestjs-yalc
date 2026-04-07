import { Injectable } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { AppLoggerFactory } from '@nestjs-yalc/logger/logger.factory';

@Injectable()
export class ProjectsDomainEventsService {
  private readonly logger = AppLoggerFactory('TaskSystem.Projects');

  constructor(private readonly events: YalcEventService) {}

  async emitProjectCreated(projectId: string, name: string) {
    await this.events.log(['task-system', 'projects', 'created'], {
      message: 'Project created',
      data: {
        projectId,
        name,
      },
      event: { await: true },
      eventAliases: ['projects.created'],
      logger: {
        instance: this.logger,
      },
    });
  }
}
