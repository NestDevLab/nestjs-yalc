import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NestHttpCallStrategyProvider } from '@nestjs-yalc/api-strategy';
import { YalcGlobalClsService } from '@nestjs-yalc/app/cls.module.js';
import { TasksDomainEventsService } from './tasks.domain-events.service';
import { TasksErrorsController } from './tasks.errors.controller';
import { TasksEventsController } from './tasks.events.controller';
import { TasksLoggingController } from './tasks.logging.controller';
import { TasksProxyController } from './tasks.proxy.controller';
import { TasksProxyService } from './tasks.proxy.service';
import { taskItemProviders, TasksController } from './task-item.resource';

@Module({
  imports: [HttpModule],
  controllers: [
    TasksController,
    TasksErrorsController,
    TasksProxyController,
    TasksLoggingController,
    TasksEventsController,
  ],
  providers: [
    ...taskItemProviders,
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
