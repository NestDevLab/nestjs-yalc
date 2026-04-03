import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import { TaskSyncState } from './task-sync-state.entity.js';

export const taskSyncStateProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskSyncState>({
    entityModel: TaskSyncState,
    resolver: false,
    service: {
      dbConnection,
      entityModel: TaskSyncState,
    },
  });
