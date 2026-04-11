import { Module } from '@nestjs/common';
import {
  ProjectsController,
  taskProjectProviders,
} from './task-project.resource';
import { ProjectsDomainEventsService } from './projects.domain-events.service';
import { ProjectsLoggingController } from './projects.logging.controller';

@Module({
  controllers: [ProjectsController, ProjectsLoggingController],
  providers: [ProjectsDomainEventsService, ...taskProjectProviders],
})
export class ProjectsModule {}
