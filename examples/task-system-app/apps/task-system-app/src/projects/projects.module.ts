import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.rest.controller';
import { ProjectsDomainEventsService } from './projects.domain-events.service';
import { ProjectsLoggingController } from './projects.logging.controller';
import { taskProjectProviders } from './task-project.resolver';

@Module({
  controllers: [ProjectsController, ProjectsLoggingController],
  providers: [ProjectsDomainEventsService, ...taskProjectProviders.providers],
})
export class ProjectsModule {}
