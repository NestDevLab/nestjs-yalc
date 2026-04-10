import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { TaskItem } from '@nestjs-yalc/task-system-module/src/task-item.entity';
import { TaskAppOmniTaskService } from '../omni-task-app/task-app-omni-task.service';
import {
  TaskItemCondition,
  TaskItemCreateInput,
  TaskItemType,
  TaskItemUpdateInput,
} from './task-item.dto';

export const taskItemProviders = CrudGenDependencyFactory<TaskItem>({
  entityModel: TaskItem,
  resolver: {
    dto: TaskItemType,
    input: {
      create: TaskItemCreateInput,
      update: TaskItemUpdateInput,
      conditions: TaskItemCondition,
    },
    prefix: 'TaskSystem_',
  },
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
});
