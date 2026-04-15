import { CrudGenResourceFactory } from '@nestjs-yalc/crud-gen';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { TaskItem } from '@nestjs-yalc/task-system-module/src/task-item.entity';
import { bindGeneratedDataloaderEventEmitter } from '../crudgen-provider-compat.js';
import { TaskAppOmniTaskService } from '../omni-task-app/task-app-omni-task.service';
import {
  TaskItemCondition,
  TaskItemCreateInput,
  TaskItemType,
  TaskItemUpdateInput,
} from './task-item.dto';

export const taskItemResource = CrudGenResourceFactory<TaskItem>({
  entityModel: TaskItem,
  backend: {
    service: {
      provider: {
        provide: getServiceToken(TaskItem),
        useExisting: TaskAppOmniTaskService,
      },
    },
    dataloader: {
      provider: {
        provide: getDataloaderToken(TaskItem),
        useFactory: (service: TaskAppOmniTaskService) =>
          new GQLDataLoader(getFn(service as any), 'guid'),
        inject: [getServiceToken(TaskItem)],
      },
    },
  },
  graphql: {
    resolver: {
      dto: TaskItemType,
      input: {
        create: TaskItemCreateInput,
        update: TaskItemUpdateInput,
        conditions: TaskItemCondition,
      },
      prefix: 'TaskSystem_',
    },
  },
  rest: {
    dto: TaskItemType,
    path: 'tasks',
    idField: 'guid',
  },
});

export const TasksController = taskItemResource.controllers[0];
export const taskItemProviders = bindGeneratedDataloaderEventEmitter(
  taskItemResource.providers,
);
