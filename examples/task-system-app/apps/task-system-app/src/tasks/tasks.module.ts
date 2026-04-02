import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NestHttpCallStrategyProvider } from '@nestjs-yalc/api-strategy';
import { YalcGlobalClsService } from '@nestjs-yalc/app/cls.module.js';
import { EventModule } from '@nestjs-yalc/event-manager';
import { TasksController } from './tasks.rest.controller';
import { TasksErrorsController } from './tasks.errors.controller';
import { TasksProxyController } from './tasks.proxy.controller';
import { TasksLoggingController } from './tasks.logging.controller';
import { TasksProxyService } from './tasks.proxy.service';

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
  ],
  providers: [
    TasksProxyService,
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
