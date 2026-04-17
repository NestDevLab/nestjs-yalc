import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ApiCallStrategySelectorProvider,
  NestHttpCallStrategy,
  NestLocalCallStrategy,
} from '@nestjs-yalc/api-strategy';
import type { AppConfigService } from '@nestjs-yalc/app/app-config.service.js';
import { YalcGlobalClsService } from '@nestjs-yalc/app/cls.module.js';
import { TasksDomainEventsService } from './tasks.domain-events.service';
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
    TaskWorkflowsService,
    TasksDomainEventsService,
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
  ],
})
export class TasksModule {}
