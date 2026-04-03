import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NestHttpCallStrategyProvider } from '@nestjs-yalc/api-strategy';
import { YalcGlobalClsService } from '@nestjs-yalc/app/cls.module.js';
import { EventModule } from '@nestjs-yalc/event-manager';
import { TasksDomainEventsService } from './tasks.domain-events.service';
import { TasksErrorsController } from './tasks.errors.controller';
import { TasksEventsController } from './tasks.events.controller';
import { TasksLoggingController } from './tasks.logging.controller';
import { TasksProxyController } from './tasks.proxy.controller';
import { TasksProxyService } from './tasks.proxy.service';
import { TasksController } from './tasks.rest.controller';

@Module({
  imports: [
    HttpModule,
    EventModule.forRootAsync({
      eventEmitter: {
        provide: EventEmitter2,
        useValue: new EventEmitter2(),
      },
    }),
  ],
  controllers: [
    TasksController,
    TasksErrorsController,
    TasksProxyController,
    TasksLoggingController,
    TasksEventsController,
  ],
  providers: [
    TasksProxyService,
    TasksDomainEventsService,
    {
      provide: YalcGlobalClsService,
      useValue: {
        get: () => ({}),
      },
    },
    NestHttpCallStrategyProvider('TASKS_HTTP_STRATEGY', {
      baseUrl: '',
    }),
  ],
})
export class TasksModule {}
