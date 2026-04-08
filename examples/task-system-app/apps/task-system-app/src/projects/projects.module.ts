import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.rest.controller';
import { ProjectsDomainEventsService } from './projects.domain-events.service';
import { ProjectsLoggingController } from './projects.logging.controller';

@Module({
  controllers: [ProjectsController, ProjectsLoggingController],
  providers: [ProjectsDomainEventsService],
})
export class ProjectsModule {}
