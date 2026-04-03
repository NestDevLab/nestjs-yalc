import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  TaskSyncStateCondition,
  TaskSyncStateCreateInput,
  TaskSyncStateType,
  TaskSyncStateUpdateInput,
} from './task-sync-state.dto.js';
import { TaskSyncState } from './task-sync-state.entity.js';

export const taskSyncStateProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskSyncState>({
    entityModel: TaskSyncState,
    resolver: {
      dto: TaskSyncStateType,
      input: {
        create: TaskSyncStateCreateInput,
        update: TaskSyncStateUpdateInput,
        conditions: TaskSyncStateCondition,
      },
      prefix: 'TaskSystem_',
    },
    service: {
      dbConnection,
      entityModel: TaskSyncState,
    },
    dataloader: { databaseKey: 'guid' },
  });
