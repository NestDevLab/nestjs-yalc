import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import { TaskSyncRef } from './task-sync-ref.entity.js';

export const taskSyncRefProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskSyncRef>({
    entityModel: TaskSyncRef,
    resolver: false,
    service: {
      dbConnection,
      entityModel: TaskSyncRef,
    },
  });
