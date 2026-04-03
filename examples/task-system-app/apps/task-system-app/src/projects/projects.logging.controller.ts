import { Controller, Get } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ProjectsDomainEventsService } from './projects.domain-events.service';

@Controller('projects-logging')
export class ProjectsLoggingController {
  constructor(private readonly service: ProjectsDomainEventsService) {}

  @Get()
  async logProjectEvent() {
    const projectId = randomUUID();
    await this.service.emitProjectCreated(projectId, 'Project event demo');

    return {
      ok: true,
      projectId,
    };
  }
}
