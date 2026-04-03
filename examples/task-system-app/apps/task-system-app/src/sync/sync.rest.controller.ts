import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { TaskSyncRef, TaskSyncRefType } from '@nestjs-yalc/task-system-module';

export const SyncController = crudRestControllerFactory<TaskSyncRef>({
  entityModel: TaskSyncRef,
  dto: TaskSyncRefType,
  path: 'sync-refs',
  idField: 'guid',
  mutations: {
    create: { decorators: [] },
    update: { decorators: [] },
  },
});
