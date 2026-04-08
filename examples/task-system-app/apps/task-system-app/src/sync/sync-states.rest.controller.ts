import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import {
  TaskSyncState,
  TaskSyncStateType,
} from '@nestjs-yalc/task-system-module';

export const SyncStatesController = crudRestControllerFactory<TaskSyncState>({
  entityModel: TaskSyncState,
  dto: TaskSyncStateType,
  path: 'sync-states',
  idField: 'guid',
  mutations: {
    create: { decorators: [] },
    update: { decorators: [] },
  },
});
