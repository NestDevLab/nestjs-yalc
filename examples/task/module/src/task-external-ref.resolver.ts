import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  TaskExternalRefCondition,
  TaskExternalRefCreateInput,
  TaskExternalRefType,
  TaskExternalRefUpdateInput,
} from './task-external-ref.dto.js';
import { TaskExternalRef } from './task-external-ref.entity.js';

export const taskExternalRefProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskExternalRef>({
    entityModel: TaskExternalRef,
    resolver: {
      dto: TaskExternalRefType,
      input: {
        create: TaskExternalRefCreateInput,
        update: TaskExternalRefUpdateInput,
        conditions: TaskExternalRefCondition,
      },
      prefix: 'TaskSystem_',
    },
    service: {
      dbConnection,
      entityModel: TaskExternalRef,
    },
    dataloader: { databaseKey: 'guid' },
  });
