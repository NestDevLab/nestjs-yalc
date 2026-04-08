import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventModule } from '@nestjs-yalc/event-manager';
import { ProjectsController } from './projects.rest.controller';
import { ProjectsDomainEventsService } from './projects.domain-events.service';
import { ProjectsLoggingController } from './projects.logging.controller';

@Module({
  imports: [
    EventModule.forRootAsync({
      eventEmitter: {
        provide: EventEmitter2,
        useValue: new EventEmitter2(),
      },
    }),
  ],
  controllers: [ProjectsController, ProjectsLoggingController],
  providers: [ProjectsDomainEventsService],
})
export class ProjectsModule {}
