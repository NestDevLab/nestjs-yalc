import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  TaskItemCondition,
  TaskItemCreateInput,
  TaskItemType,
  TaskItemUpdateInput,
} from './task-item.dto.js';
import { TaskItem } from './task-item.entity.js';

export const taskItemProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskItem>({
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
      dbConnection,
      entityModel: TaskItem,
    },
    dataloader: { databaseKey: 'guid' },
  });
