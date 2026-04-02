import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import { TaskItem } from './task-item.entity.js';

export const taskItemProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskItem>({
    entityModel: TaskItem,
    resolver: false,
    service: {
      dbConnection,
      entityModel: TaskItem,
    },
  });
