import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ApiCallStrategySelectorProvider,
  CompositeEventStrategy,
  ConditionalEventStrategy,
  EventStrategySelectorProvider,
  NestHttpCallStrategy,
  NestLocalCallStrategy,
  NestLocalEventStrategy,
  RabbitMqEventStrategy,
} from '@nestjs-yalc/api-strategy';
import type { AppConfigService } from '@nestjs-yalc/app/app-config.service.js';
import { YalcGlobalClsService } from '@nestjs-yalc/app/cls.module.js';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { TasksDomainEventsService } from './tasks.domain-events.service';
import { TaskEventsAuditStore } from './events/task-events-audit.store';
import { TaskEventsLocalHandler } from './events/task-events-local.handler';
import { TaskEventsRabbitMqHandler } from './events/task-events-rabbitmq.handler';
import { TasksErrorsController } from './tasks.errors.controller';
import { TasksEventsController } from './tasks.events.controller';
import { TasksLoggingController } from './tasks.logging.controller';
import { TaskWorkflowsController } from './task-workflows.controller';
import { TaskWorkflowsService } from './task-workflows.service';
import {
  TASKS_CLIENT_API_STRATEGY,
  TASKS_CLIENT_HTTP_API_STRATEGY,
  TASKS_CLIENT_LOCAL_API_STRATEGY,
  TasksApiClient,
} from '@nestjs-yalc/task-system-module/src/client/tasks-api.client';
import {
  TASK_EVENTS_LOCAL_STRATEGY,
  TASK_EVENTS_RABBITMQ_STRATEGY,
  TASK_EVENTS_STRATEGY,
  TasksEventsClient,
} from '@nestjs-yalc/task-system-module/src/events/tasks-events.client';
import { taskItemProviders, TasksController } from './task-item.resource';

@Module({
  imports: [HttpModule],
  controllers: [
    TasksController,
    TasksErrorsController,
    TaskWorkflowsController,
    TasksLoggingController,
    TasksEventsController,
  ],
  providers: [
    ...taskItemProviders,
    TasksApiClient,
    TasksEventsClient,
    TaskWorkflowsService,
    TasksDomainEventsService,
    TaskEventsAuditStore,
    TaskEventsLocalHandler,
    TaskEventsRabbitMqHandler,
    {
      provide: YalcGlobalClsService,
      useValue: {
        get: () => ({}),
      },
    },
    {
      provide: TASKS_CLIENT_LOCAL_API_STRATEGY,
      useFactory: (
        httpAdapterHost: HttpAdapterHost,
        clsService: YalcGlobalClsService,
      ) => {
        const configService = {
          values: {},
        } as AppConfigService<{ internalRequestToken?: string }>;

        return new NestLocalCallStrategy(
          httpAdapterHost,
          clsService,
          configService,
        );
      },
      inject: [HttpAdapterHost, YalcGlobalClsService],
    },
    {
      provide: TASKS_CLIENT_HTTP_API_STRATEGY,
      useFactory: (
        httpService: HttpService,
        clsService: YalcGlobalClsService,
      ) => {
        const baseUrl = process.env.TASKS_HTTP_BASE_URL?.trim();

        if (!baseUrl && process.env.TASKS_API_STRATEGY === 'http') {
          throw new Error(
            'TASKS_HTTP_BASE_URL must be set to an absolute base URL when TASKS_API_STRATEGY is "http".',
          );
        }

        return new NestHttpCallStrategy(httpService, clsService, baseUrl ?? '');
      },
      inject: [HttpService, YalcGlobalClsService],
    },
    ApiCallStrategySelectorProvider({
      provide: TASKS_CLIENT_API_STRATEGY,
      defaultStrategy: 'local',
      strategies: {
        local: TASKS_CLIENT_LOCAL_API_STRATEGY,
        http: TASKS_CLIENT_HTTP_API_STRATEGY,
      },
      selector: {
        useFactory: () => process.env.TASKS_API_STRATEGY,
      },
    }),
    {
      provide: TASK_EVENTS_LOCAL_STRATEGY,
      useFactory: (events: YalcEventService) =>
        new NestLocalEventStrategy(events.emitter),
      inject: [YalcEventService],
    },
    {
      provide: TASK_EVENTS_RABBITMQ_STRATEGY,
      useFactory: (localStrategy: NestLocalEventStrategy) =>
        new CompositeEventStrategy([
          localStrategy,
          new ConditionalEventStrategy(
            new RabbitMqEventStrategy(createTaskEventsRabbitMqOptions()),
            {
              enabled: () =>
                process.env.TASK_RABBITMQ_PUBLISH_ENABLED !== 'false',
              disabledResult: false,
            },
          ),
        ]),
      inject: [TASK_EVENTS_LOCAL_STRATEGY],
    },
    EventStrategySelectorProvider({
      provide: TASK_EVENTS_STRATEGY,
      defaultStrategy: 'local',
      strategies: {
        local: TASK_EVENTS_LOCAL_STRATEGY,
        rabbitmq: TASK_EVENTS_RABBITMQ_STRATEGY,
      },
      selector: {
        useFactory: () => process.env.TASK_EVENTS_STRATEGY,
      },
    }),
  ],
})
export class TasksModule {}

function createTaskEventsRabbitMqOptions() {
  const url = process.env.TASK_RABBITMQ_URL?.trim();

  if (!url && process.env.TASK_EVENTS_STRATEGY === 'rabbitmq') {
    throw new Error(
      'TASK_RABBITMQ_URL must be set when TASK_EVENTS_STRATEGY is "rabbitmq".',
    );
  }

  return {
    url: url ?? 'amqp://127.0.0.1:5672',
    exchange:
      process.env.TASK_RABBITMQ_EXCHANGE?.trim() || 'task-system.events',
  };
}
